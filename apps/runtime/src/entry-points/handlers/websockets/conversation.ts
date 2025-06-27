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
import { metricsService } from '../../../services/metrics-service';
import { websocketMessageService } from '../../../services/websocket-message-service';

interface ChatMessage {
  message: string;
  sessionId?: string;
  timestamp: string;
}

interface WebSocketMessage {
  type: 'auth' | 'message' | 'ping';
  data: {
    action: string;
    message?: string;
    sessionId?: string;
    token?: string;
  };
}

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  const correlationId = `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  metrics.addMetric('WebSocketRequest', 'Count', 1);
  metrics.addDimension('Environment', process.env.ENVIRONMENT || 'dev');

  logger.info('WebSocket message event received', {
    httpMethod: event.httpMethod,
    path: event.path,
    requestId: event.requestContext.requestId,
    eventType: event.requestContext.eventType,
    correlationId,
    connectionId: event.requestContext.connectionId,
    body: event.body,
  });

  const subsegment = tracer
    .getSegment()
    ?.addNewSubsegment('websocket_conversation');
  const connectionId = event.requestContext.connectionId!;

  try {
    logger.info('WebSocket conversation event received', {
      connectionId,
      eventType: event.requestContext.eventType,
      routeKey: event.requestContext.routeKey,
      correlationId,
    });

    if (!event.body) {
      const error = createError(
        ErrorType.VALIDATION_ERROR,
        'Request body is required',
        'MISSING_BODY',
        { connectionId }
      );

      logger.error('Missing request body in WebSocket event', {
        connectionId,
        correlationId,
      });

      await metricsService.recordErrorMetrics(
        'MISSING_BODY',
        'websocket_conversation',
        {
          connectionId,
        }
      );

      return createErrorResponse(error, event);
    }

    let websocketMessage: WebSocketMessage;

    try {
      const parsedBody = JSON.parse(event.body);

      // Validate message format
      if (!parsedBody.type || !parsedBody.data) {
        const error = createError(
          ErrorType.VALIDATION_ERROR,
          'Invalid message format. Expected {type, data} structure',
          'INVALID_MESSAGE_FORMAT',
          { parsedBody }
        );

        logger.error('Invalid message format', {
          parsedBody,
          correlationId,
        });

        await metricsService.recordErrorMetrics(
          'INVALID_MESSAGE_FORMAT',
          'websocket_conversation',
          {
            connectionId,
          }
        );

        return createErrorResponse(error, event);
      }

      // Validate message type
      if (!['auth', 'message', 'ping'].includes(parsedBody.type)) {
        const error = createError(
          ErrorType.VALIDATION_ERROR,
          'Invalid message type. Expected: auth, message, or ping',
          'INVALID_MESSAGE_TYPE',
          { messageType: parsedBody.type }
        );

        logger.error('Invalid message type', {
          messageType: parsedBody.type,
          correlationId,
        });

        await metricsService.recordErrorMetrics(
          'INVALID_MESSAGE_TYPE',
          'websocket_conversation',
          {
            connectionId,
            messageType: parsedBody.type,
          }
        );

        return createErrorResponse(error, event);
      }

      websocketMessage = parsedBody as WebSocketMessage;

      logger.info('Parsed WebSocket message', {
        connectionId,
        type: websocketMessage.type,
        action: websocketMessage.data.action,
        hasToken: !!websocketMessage.data.token,
        messageLength: websocketMessage.data.message?.length,
        correlationId,
      });
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
        correlationId,
      });

      await metricsService.recordErrorMetrics(
        'INVALID_JSON',
        'websocket_conversation',
        {
          connectionId,
        }
      );

      return createErrorResponse(error, event);
    }

    const { type, data } = websocketMessage;
    const { action, message, sessionId, token } = data;

    // Handle authentication
    if (type === 'auth' && action === 'authenticate') {
      logger.info('Received authentication message', {
        connectionId,
        tokenLength: token?.length,
        correlationId,
      });
      return await handleAuthentication(
        connectionId,
        event,
        token,
        correlationId
      );
    }

    // Check if connection is authenticated for other actions
    const isAuthenticated =
      await authenticationService.isConnectionAuthenticated(connectionId);
    logger.info('Authentication status for connection', {
      connectionId,
      isAuthenticated,
      action,
      type,
      correlationId,
    });
    if (!isAuthenticated) {
      const error = createError(
        ErrorType.AUTHENTICATION_ERROR,
        'Authentication required',
        'UNAUTHENTICATED_CONNECTION',
        { connectionId, action }
      );

      logger.error('Unauthenticated connection attempting to send message', {
        connectionId,
        action,
        correlationId,
        body: event.body,
      });

      await metricsService.recordErrorMetrics(
        'UNAUTHENTICATED_CONNECTION',
        'websocket_conversation',
        {
          connectionId,
          action,
        }
      );

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
    if (type === 'message' && action === 'sendMessage') {
      logger.info('Received chat message', {
        connectionId,
        sessionId,
        messageLength: message?.length,
        correlationId,
      });
      if (!message) {
        const error = createError(
          ErrorType.VALIDATION_ERROR,
          'Message is required',
          'MISSING_MESSAGE',
          { websocketMessage }
        );

        logger.error('Missing message in sendMessage action', {
          websocketMessage,
          correlationId,
        });

        await metricsService.recordErrorMetrics(
          'MISSING_MESSAGE',
          'websocket_conversation',
          {
            connectionId,
          }
        );

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

        logger.error('Message too long', {
          messageLength: message.length,
          correlationId,
        });

        await metricsService.recordErrorMetrics(
          'MESSAGE_TOO_LONG',
          'websocket_conversation',
          {
            connectionId,
            messageLength: message.length.toString(),
          }
        );

        return createErrorResponse(error, event);
      }

      return await handleChatMessage(
        connectionId,
        event,
        message,
        sessionId,
        correlationId
      );
    }

    // Handle ping messages
    if (type === 'ping') {
      logger.info('Received ping message', {
        connectionId,
        correlationId,
      });
      await metricsService.recordWebSocketMetrics('ping', true, 0);
      return createSuccessResponse({
        statusCode: 200,
        body: '',
      });
    }

    // Invalid action
    const error = createError(
      ErrorType.VALIDATION_ERROR,
      'Invalid action',
      'INVALID_ACTION',
      {
        expectedActions: ['authenticate', 'sendMessage'],
        actualAction: action,
      }
    );

    logger.error('Invalid action in WebSocket message', {
      action,
      correlationId,
    });

    await metricsService.recordErrorMetrics(
      'INVALID_ACTION',
      'websocket_conversation',
      {
        connectionId,
        action,
      }
    );

    return createErrorResponse(error, event);
  } catch (error) {
    const appError = handleError(error as Error, {
      requestId: event.requestContext.requestId,
      connectionId: event.requestContext.connectionId,
      action: 'websocket_conversation',
      event,
    });

    await metricsService.recordErrorMetrics(
      'UNEXPECTED_ERROR',
      'websocket_conversation',
      {
        connectionId,
        errorType: appError.type,
      }
    );

    return createErrorResponse(appError, event);
  } finally {
    const duration = Date.now() - startTime;
    await metricsService.recordWebSocketMetrics(
      'message_received',
      true,
      duration
    );
    subsegment?.close();
  }
};

/**
 * Handle authentication message
 */
async function handleAuthentication(
  connectionId: string,
  event: APIGatewayProxyEvent,
  token?: string,
  correlationId?: string
): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();

  try {
    logger.info('Processing authentication request', {
      connectionId,
      hasToken: !!token,
      correlationId,
    });

    const authResult = await authenticationService.authenticateUser(
      token || ''
    );

    if (authResult.success && authResult.user) {
      await authenticationService.storeAuthenticatedConnection(
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
        correlationId,
      });

      await metricsService.recordBusinessMetrics('authentication_success', 1, {
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
        correlationId,
      });

      await metricsService.recordBusinessMetrics('authentication_failure', 1, {
        connectionId,
        errorType: authResult.error || 'UNKNOWN_ERROR',
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

    await metricsService.recordErrorMetrics(
      'AUTHENTICATION_ERROR',
      'authentication',
      {
        connectionId,
        errorType: appError.type,
      }
    );

    await errorHandlingService.handleWebSocketError(
      appError,
      connectionId,
      event
    );

    return createSuccessResponse({
      statusCode: 200,
      body: '',
    });
  } finally {
    const duration = Date.now() - startTime;
    await metricsService.recordWebSocketMetrics('connect', true, duration);
  }
}

/**
 * Handle chat message
 */
async function handleChatMessage(
  connectionId: string,
  event: APIGatewayProxyEvent,
  message: string,
  sessionId?: string,
  correlationId?: string
): Promise<APIGatewayProxyResult> {
  const startTime = Date.now();

  try {
    const user =
      await authenticationService.getUserFromConnection(connectionId);
    if (!user) {
      const error = createError(
        ErrorType.AUTHENTICATION_ERROR,
        'User not found for authenticated connection',
        'USER_NOT_FOUND',
        { connectionId }
      );

      logger.error('User not found for authenticated connection', {
        connectionId,
        correlationId,
      });

      await metricsService.recordErrorMetrics(
        'USER_NOT_FOUND',
        'chat_message',
        {
          connectionId,
        }
      );

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

    logger.info('Storing user message in DynamoDB', {
      userMessage,
      correlationId,
    });

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

      await metricsService.recordDatabaseMetrics(
        'store_user_message',
        process.env.WEBSOCKET_MESSAGES_TABLE!,
        true,
        Date.now() - startTime
      );
    } catch (dbError) {
      const error = errorHandlingService.handleDatabaseError(
        dbError,
        'store_user_message',
        { connectionId, userId: user.userId, sessionId: currentSessionId }
      );

      await metricsService.recordDatabaseMetrics(
        'store_user_message',
        process.env.WEBSOCKET_MESSAGES_TABLE!,
        false,
        Date.now() - startTime,
        'DATABASE_ERROR'
      );

      throw error;
    }

    logger.info('User message stored successfully', {
      userMessage,
      correlationId,
    });

    // Echo the message back (initial behavior)
    const echoMessage = message;

    // Store bot response in DynamoDB
    const botMessage: ChatMessage = {
      message: echoMessage,
      sessionId: currentSessionId,
      timestamp: new Date().toISOString(),
    };

    logger.info('Storing bot message in DynamoDB', {
      botMessage,
      correlationId,
    });

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

      await metricsService.recordDatabaseMetrics(
        'store_bot_message',
        process.env.WEBSOCKET_MESSAGES_TABLE!,
        true,
        Date.now() - startTime
      );
    } catch (dbError) {
      const error = errorHandlingService.handleDatabaseError(
        dbError,
        'store_bot_message',
        { connectionId, userId: user.userId, sessionId: currentSessionId }
      );

      await metricsService.recordDatabaseMetrics(
        'store_bot_message',
        process.env.WEBSOCKET_MESSAGES_TABLE!,
        false,
        Date.now() - startTime,
        'DATABASE_ERROR'
      );

      throw error;
    }

    logger.info('Bot message stored successfully', {
      botMessage,
      correlationId,
    });

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

      await metricsService.recordErrorMetrics(
        'WEBSOCKET_SEND_FAILED',
        'chat_message',
        {
          connectionId,
        }
      );

      throw error;
    }

    logger.info('WebSocket message processed successfully', {
      requestId: event.requestContext.requestId,
      sessionId: currentSessionId,
      messageLength: message.length,
      userId: user.userId,
      correlationId,
    });

    await metricsService.recordBusinessMetrics('message_processed', 1, {
      connectionId,
      userId: user.userId,
      sessionId: currentSessionId,
    });

    return createSuccessResponse({
      statusCode: 200,
      body: '',
    });
  } catch (error) {
    const appError = handleError(error as Error, {
      connectionId,
      userId: await authenticationService
        .getUserFromConnection(connectionId)
        ?.then(u => u?.userId),
      action: 'chat_message',
      event,
    });

    await metricsService.recordErrorMetrics(
      'CHAT_MESSAGE_ERROR',
      'chat_message',
      {
        connectionId,
        errorType: appError.type,
      }
    );

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
        correlationId,
      });
    }

    return createErrorResponse(appError, event);
  } finally {
    const duration = Date.now() - startTime;
    await metricsService.recordWebSocketMetrics(
      'message_processed',
      true,
      duration
    );
  }
}
