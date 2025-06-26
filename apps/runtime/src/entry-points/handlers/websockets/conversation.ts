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
      logger.error('Missing connectionId in requestContext', {
        requestContext: event.requestContext,
      });
      return createSuccessResponse(
        {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing connection ID' }),
        },
        400
      );
    }

    if (event.requestContext.eventType !== 'MESSAGE') {
      logger.error('Invalid event type for conversation handler', {
        eventType: event.requestContext.eventType,
      });
      return createSuccessResponse(
        {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid event type' }),
        },
        400
      );
    }

    if (!event.body) {
      logger.error('Missing body in MESSAGE event', { event });
      return createSuccessResponse(
        {
          statusCode: 400,
          body: JSON.stringify({ error: 'Request body is required' }),
        },
        400
      );
    }

    let websocketEvent: WebSocketEvent;
    try {
      websocketEvent = JSON.parse(event.body);
    } catch (parseError) {
      logger.error('Failed to parse event.body as JSON', {
        body: event.body,
        parseError,
      });
      return createSuccessResponse(
        {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid JSON in request body' }),
        },
        400
      );
    }

    const { action, message, sessionId, token } = websocketEvent;
    logger.info('Parsed WebSocketEvent', { action, message, sessionId });

    // Handle authentication
    if (action === 'authenticate') {
      return await handleAuthentication(connectionId, event, token);
    }

    // Check if connection is authenticated for other actions
    if (!authenticationService.isConnectionAuthenticated(connectionId)) {
      logger.error('Unauthenticated connection attempting to send message', {
        connectionId,
        action,
      });

      await websocketMessageService.sendErrorMessage(
        connectionId,
        event,
        'Authentication required'
      );

      return createSuccessResponse({
        statusCode: 200,
        body: '',
      });
    }

    // Handle regular messages
    if (action !== 'sendMessage') {
      logger.error('Invalid action in MESSAGE event', { action });
      return createSuccessResponse(
        {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid action' }),
        },
        400
      );
    }

    if (!message) {
      logger.error('Missing message in sendMessage action', {
        websocketEvent,
      });
      return createSuccessResponse(
        {
          statusCode: 400,
          body: JSON.stringify({ error: 'Message is required' }),
        },
        400
      );
    }

    // Validate message length
    if (message.length > 1000) {
      logger.error('Message too long', { messageLength: message.length });
      return createSuccessResponse(
        {
          statusCode: 400,
          body: JSON.stringify({
            error: 'Message too long (max 1000 characters)',
          }),
        },
        400
      );
    }

    return await handleChatMessage(connectionId, event, message, sessionId);
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
  const authResult = await authenticationService.authenticateUser(token || '');

  if (authResult.success && authResult.user) {
    authenticationService.storeAuthenticatedConnection(
      connectionId,
      authResult.user
    );

    await websocketMessageService.sendAuthResponse(connectionId, event, true, {
      userId: authResult.user.userId,
      username: authResult.user.username,
    });

    logger.info('WebSocket authentication successful', {
      connectionId,
      userId: authResult.user.userId,
    });
  } else {
    await websocketMessageService.sendAuthResponse(connectionId, event, false, {
      error: authResult.error,
    });

    logger.error('WebSocket authentication failed', {
      connectionId,
      error: authResult.error,
    });
  }

  return createSuccessResponse({
    statusCode: 200,
    body: '',
  });
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
  const user = authenticationService.getUserFromConnection(connectionId);
  if (!user) {
    logger.error('User not found for authenticated connection', {
      connectionId,
    });
    return createSuccessResponse(
      {
        statusCode: 400,
        body: JSON.stringify({ error: 'User not found' }),
      },
      400
    );
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

  logger.info('Bot message stored successfully', { botMessage });

  // Send the response back to the user via WebSocket
  await websocketMessageService.sendChatResponse(
    connectionId,
    event,
    echoMessage,
    currentSessionId,
    true // isEcho
  );

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
}
