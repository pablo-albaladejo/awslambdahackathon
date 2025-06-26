import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  createSuccessResponse,
  logger,
  metrics,
  tracer,
} from '@awslambdahackathon/utils/lambda';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { authenticationService } from '../../../services/authentication-service';
import {
  createError,
  createErrorResponse,
  errorHandlingService,
  ErrorType,
  handleError,
} from '../../../services/error-handling-service';
import { websocketMessageService } from '../../../services/websocket-message-service';

interface ChatMessage {
  message: string;
  sessionId?: string;
  timestamp: string;
}

interface WebSocketEvent {
  action: string;
  message?: string;
  sessionId?: string;
  token?: string;
}

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  metrics.addMetric('WebSocketRequest', 'Count', 1);
  metrics.addDimension('Environment', process.env.ENVIRONMENT || 'dev');

  logger.info('WebSocket message event received', {
    httpMethod: event.httpMethod,
    path: event.path,
    requestId: event.requestContext.requestId,
    eventType: event.requestContext.eventType,
  });

  const segment = tracer.getSegment();
  const subsegment = segment?.addNewSubsegment('websocket-conversation-logic');

  try {
    const connectionId = event.requestContext.connectionId;
    if (!connectionId) {
      const error = createError(
        ErrorType.VALIDATION_ERROR,
        'Missing connection ID',
        'MISSING_CONNECTION_ID',
        { requestContext: event.requestContext }
      );

      logger.error('Missing connectionId in requestContext', {
        requestContext: event.requestContext,
      });

      return createErrorResponse(error, event);
    }

    if (event.requestContext.eventType !== 'MESSAGE') {
      const error = createError(
        ErrorType.VALIDATION_ERROR,
        'Invalid event type for conversation handler',
        'INVALID_EVENT_TYPE',
        {
          expectedType: 'MESSAGE',
          actualType: event.requestContext.eventType,
        }
      );

      logger.error('Invalid event type for conversation handler', {
        eventType: event.requestContext.eventType,
      });

      return createErrorResponse(error, event);
    }

    if (!event.body) {
      const error = createError(
        ErrorType.VALIDATION_ERROR,
        'Request body is required',
        'MISSING_REQUEST_BODY'
      );

      logger.error('Missing body in MESSAGE event', { event });

      return createErrorResponse(error, event);
    }

    let websocketEvent: WebSocketEvent;
    try {
      websocketEvent = JSON.parse(event.body);
    } catch (parseError) {
      const error = createError(
        ErrorType.VALIDATION_ERROR,
        'Invalid JSON in request body',
        'INVALID_JSON',
        {
          body: event.body,
          parseError:
            parseError instanceof Error
              ? parseError.message
              : String(parseError),
        }
      );

      logger.error('Failed to parse event.body as JSON', {
        body: event.body,
        parseError,
      });

      return createErrorResponse(error, event);
    }

    const { action, message, sessionId, token } = websocketEvent;
    logger.info('Parsed WebSocketEvent', { action, message, sessionId });

    // Handle authentication
    if (action === 'authenticate') {
      return await handleAuthentication(connectionId, event, token);
    }

    // Check if connection is authenticated for other actions
    if (!authenticationService.isConnectionAuthenticated(connectionId)) {
      const error = createError(
        ErrorType.AUTHENTICATION_ERROR,
        'Authentication required',
        'UNAUTHENTICATED_CONNECTION',
        { connectionId, action }
      );

      logger.error('Unauthenticated connection attempting to send message', {
        connectionId,
        action,
      });

      await errorHandlingService.handleWebSocketError(
        error,
        connectionId,
        event
      );

      return createSuccessResponse({
        statusCode: 200,
        body: '',
      });
    }

    // Handle regular messages
    if (action !== 'sendMessage') {
      const error = createError(
        ErrorType.VALIDATION_ERROR,
        'Invalid action',
        'INVALID_ACTION',
        {
          expectedAction: 'sendMessage',
          actualAction: action,
        }
      );

      logger.error('Invalid action in MESSAGE event', { action });

      return createErrorResponse(error, event);
    }

    if (!message) {
      const error = createError(
        ErrorType.VALIDATION_ERROR,
        'Message is required',
        'MISSING_MESSAGE',
        { websocketEvent }
      );

      logger.error('Missing message in sendMessage action', {
        websocketEvent,
      });

      return createErrorResponse(error, event);
    }

    // Validate message length
    if (message.length > 1000) {
      const error = createError(
        ErrorType.VALIDATION_ERROR,
        'Message too long (max 1000 characters)',
        'MESSAGE_TOO_LONG',
        { messageLength: message.length, maxLength: 1000 }
      );

      logger.error('Message too long', { messageLength: message.length });

      return createErrorResponse(error, event);
    }

    return await handleChatMessage(connectionId, event, message, sessionId);
  } catch (error) {
    const appError = handleError(error as Error, {
      requestId: event.requestContext.requestId,
      connectionId: event.requestContext.connectionId,
      action: 'websocket_conversation',
      event,
    });

    return createErrorResponse(appError, event);
  } finally {
    subsegment?.close();
  }
};

/**
 * Handle authentication message
 */
async function handleAuthentication(
  connectionId: string,
  event: APIGatewayProxyEvent,
  token?: string
): Promise<APIGatewayProxyResult> {
  try {
    const authResult = await authenticationService.authenticateUser(
      token || ''
    );

    if (authResult.success && authResult.user) {
      authenticationService.storeAuthenticatedConnection(
        connectionId,
        authResult.user
      );

      await websocketMessageService.sendAuthResponse(
        connectionId,
        event,
        true,
        {
          userId: authResult.user.userId,
          username: authResult.user.username,
        }
      );

      logger.info('WebSocket authentication successful', {
        connectionId,
        userId: authResult.user.userId,
      });
    } else {
      await websocketMessageService.sendAuthResponse(
        connectionId,
        event,
        false,
        { error: authResult.error }
      );

      logger.error('WebSocket authentication failed', {
        connectionId,
        error: authResult.error,
      });
    }

    return createSuccessResponse({
      statusCode: 200,
      body: '',
    });
  } catch (error) {
    const appError = handleError(error as Error, {
      connectionId,
      action: 'authentication',
      event,
    });

    await errorHandlingService.handleWebSocketError(
      appError,
      connectionId,
      event
    );

    return createSuccessResponse({
      statusCode: 200,
      body: '',
    });
  }
}

/**
 * Handle chat message
 */
async function handleChatMessage(
  connectionId: string,
  event: APIGatewayProxyEvent,
  message: string,
  sessionId?: string
): Promise<APIGatewayProxyResult> {
  try {
    const user = authenticationService.getUserFromConnection(connectionId);
    if (!user) {
      const error = createError(
        ErrorType.AUTHENTICATION_ERROR,
        'User not found for authenticated connection',
        'USER_NOT_FOUND',
        { connectionId }
      );

      logger.error('User not found for authenticated connection', {
        connectionId,
      });

      return createErrorResponse(error, event);
    }

    const currentSessionId =
      sessionId ||
      `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const now = new Date();
    const timestamp = now.toISOString();

    // Store user message in DynamoDB
    const userMessage: ChatMessage = {
      message,
      sessionId: currentSessionId,
      timestamp,
    };

    logger.info('Storing user message in DynamoDB', { userMessage });

    try {
      await ddbDocClient.send(
        new PutCommand({
          TableName: process.env.WEBSOCKET_MESSAGES_TABLE,
          Item: {
            ...userMessage,
            ttl: Math.floor(now.getTime() / 1000) + 24 * 60 * 60, // 24 hours TTL
            type: 'user',
            connectionId,
            userId: user.userId,
          },
        })
      );
    } catch (dbError) {
      const error = errorHandlingService.handleDatabaseError(
        dbError,
        'store_user_message',
        { connectionId, userId: user.userId, sessionId: currentSessionId }
      );

      throw error;
    }

    logger.info('User message stored successfully', { userMessage });

    // Echo the message back (initial behavior)
    const echoMessage = message;

    // Store bot response in DynamoDB
    const botMessage: ChatMessage = {
      message: echoMessage,
      sessionId: currentSessionId,
      timestamp: new Date().toISOString(),
    };

    logger.info('Storing bot message in DynamoDB', { botMessage });

    try {
      await ddbDocClient.send(
        new PutCommand({
          TableName: process.env.WEBSOCKET_MESSAGES_TABLE,
          Item: {
            ...botMessage,
            ttl: Math.floor(now.getTime() / 1000) + 24 * 60 * 60, // 24 hours TTL
            type: 'bot',
            connectionId,
            userId: user.userId,
          },
        })
      );
    } catch (dbError) {
      const error = errorHandlingService.handleDatabaseError(
        dbError,
        'store_bot_message',
        { connectionId, userId: user.userId, sessionId: currentSessionId }
      );

      throw error;
    }

    logger.info('Bot message stored successfully', { botMessage });

    // Send the response back to the user via WebSocket
    try {
      await websocketMessageService.sendChatResponse(
        connectionId,
        event,
        echoMessage,
        currentSessionId,
        true // isEcho
      );
    } catch (wsError) {
      const error = createError(
        ErrorType.WEBSOCKET_ERROR,
        'Failed to send message to client',
        'WEBSOCKET_SEND_FAILED',
        {
          connectionId,
          originalError:
            wsError instanceof Error ? wsError.message : String(wsError),
        }
      );

      throw error;
    }

    logger.info('WebSocket message processed successfully', {
      requestId: event.requestContext.requestId,
      sessionId: currentSessionId,
      messageLength: message.length,
      userId: user.userId,
    });

    return createSuccessResponse({
      statusCode: 200,
      body: '',
    });
  } catch (error) {
    const appError = handleError(error as Error, {
      connectionId,
      userId: authenticationService.getUserFromConnection(connectionId)?.userId,
      action: 'chat_message',
      event,
    });

    // Try to send error to WebSocket client
    try {
      await errorHandlingService.handleWebSocketError(
        appError,
        connectionId,
        event
      );
    } catch (sendError) {
      logger.error('Failed to send error to WebSocket client', {
        connectionId,
        originalError: appError,
        sendError,
      });
    }

    return createErrorResponse(appError, event);
  }
}
