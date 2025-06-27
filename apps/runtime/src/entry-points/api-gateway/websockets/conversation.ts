import {
  commonSchemas,
  createSuccessResponse,
  createWebSocketHandler,
  logger,
  metrics,
  tracer,
} from '@awslambdahackathon/utils/lambda';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { authenticateUser } from '../../../application/use-cases/authenticate-user';
import { isConnectionAuthenticated } from '../../../application/use-cases/check-authenticated-connection';
import { handlePingMessage as handlePingMessageUseCase } from '../../../application/use-cases/handle-ping-message';
import { sendChatMessage } from '../../../application/use-cases/send-chat-message';
import { authenticationService } from '../../../services/authentication-service';
import { chatService } from '../../../services/chat-service';
import {
  createError,
  createErrorResponse,
  errorHandlingService,
  ErrorType,
  handleError,
} from '../../../services/error-handling-service';
import { metricsService } from '../../../services/metrics-service';
import { websocketMessageService } from '../../../services/websocket-message-service';

interface WebSocketMessage {
  type: 'auth' | 'message' | 'ping';
  data: {
    action: string;
    message?: string;
    sessionId?: string;
    token?: string;
  };
}

// Constants for message types and actions
const VALID_MESSAGE_TYPES = ['auth', 'message', 'ping'] as const;
const VALID_ACTIONS = ['authenticate', 'sendMessage'] as const;

// Helper function to generate correlation ID
const generateCorrelationId = (): string => {
  return `conv-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`;
};

// Helper function to validate connection ID
const validateConnectionId = (event: APIGatewayProxyEvent): string => {
  const connectionId = event.requestContext.connectionId;
  if (!connectionId) {
    throw new Error('Missing connection ID in request context');
  }
  return connectionId;
};

// Helper function to parse WebSocket message
const parseWebSocketMessage = (
  event: APIGatewayProxyEvent,
  context?: any
): WebSocketMessage => {
  if (!event.body) {
    throw new Error('Request body is required');
  }

  // Use parsed body from middleware if available
  if (context?.parsedBody) {
    return context.parsedBody as WebSocketMessage;
  }

  // Manual parsing as fallback
  try {
    const parsedBody = JSON.parse(event.body);

    // Validate message format
    if (!parsedBody.type || !parsedBody.data) {
      throw new Error(
        'Invalid message format. Expected {type, data} structure'
      );
    }

    // Validate message type
    if (!VALID_MESSAGE_TYPES.includes(parsedBody.type)) {
      throw new Error(
        `Invalid message type. Expected: ${VALID_MESSAGE_TYPES.join(', ')}`
      );
    }

    return parsedBody as WebSocketMessage;
  } catch (parseError) {
    if (parseError instanceof Error) {
      throw parseError;
    }
    throw new Error('Invalid JSON in request body');
  }
};

// Handler for authentication messages
const handleAuthMessage = async (
  message: WebSocketMessage,
  connectionId: string,
  event: APIGatewayProxyEvent,
  correlationId: string
): Promise<APIGatewayProxyResult> => {
  const { data } = message;
  const { action, token } = data;

  if (action !== 'authenticate') {
    throw new Error(`Invalid action for auth message: ${action}`);
  }

  logger.info('Received authentication message', {
    connectionId,
    hasToken: !!token,
    correlationId,
  });

  const authResult = await authenticateUser(
    typeof token === 'string' ? token : ''
  );

  if (authResult.success && authResult.user) {
    const safeUserId = authResult.user.userId
      ? String(authResult.user.userId)
      : '';

    await authenticationService.storeAuthenticatedConnection(connectionId, {
      ...authResult.user,
      userId: safeUserId,
    });

    await websocketMessageService.sendAuthResponse(connectionId, event, true, {
      userId: safeUserId,
      username: authResult.user.username,
    });

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
    await websocketMessageService.sendAuthResponse(connectionId, event, false, {
      error: authResult.error,
    });

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
};

// Handler for chat messages
const handleChatMessage = async (
  message: WebSocketMessage,
  connectionId: string,
  event: APIGatewayProxyEvent,
  correlationId: string
): Promise<APIGatewayProxyResult> => {
  const { data } = message;
  const { action, message: chatMessage, sessionId } = data;

  if (action !== 'sendMessage') {
    throw new Error(`Invalid action for message: ${action}`);
  }

  logger.info('Received chat message', {
    connectionId,
    sessionId,
    messageLength: chatMessage?.length,
    correlationId,
  });

  const { message: echoMessage, sessionId: currentSessionId } =
    await sendChatMessage(chatService, {
      connectionId,
      message: chatMessage ?? '',
      sessionId,
    });

  await websocketMessageService.sendChatResponse(
    connectionId,
    event,
    echoMessage,
    currentSessionId,
    true // isEcho
  );

  return createSuccessResponse({
    statusCode: 200,
    body: '',
  });
};

// Handler for ping messages
const handlePingMessageHandler = async (
  connectionId: string
): Promise<APIGatewayProxyResult> => {
  await handlePingMessageUseCase(connectionId);
  await metricsService.recordWebSocketMetrics('ping', true, 0);

  return createSuccessResponse({
    statusCode: 200,
    body: '',
  });
};

// Main conversation handler
const conversationHandler = async (
  event: APIGatewayProxyEvent,
  context?: any
): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  const correlationId = generateCorrelationId();

  metrics.addMetric('WebSocketRequest', 'Count', 1);
  metrics.addDimension('Environment', process.env.ENVIRONMENT || 'dev');

  logger.info('WebSocket message event received', {
    httpMethod: event.httpMethod,
    path: event.path,
    requestId: event.requestContext.requestId,
    eventType: event.requestContext.eventType,
    correlationId,
    connectionId: event.requestContext.connectionId,
    bodyLength: event.body?.length,
    hasBody: !!event.body,
  });

  const subsegment = tracer
    .getSegment()
    ?.addNewSubsegment('websocket_conversation');
  const connectionId = validateConnectionId(event);

  try {
    logger.info('WebSocket conversation event received', {
      connectionId,
      eventType: event.requestContext.eventType,
      routeKey: event.requestContext.routeKey,
      correlationId,
    });

    // Parse and validate the WebSocket message
    const websocketMessage = parseWebSocketMessage(event, context);

    logger.info('Parsed WebSocket message', {
      connectionId,
      type: websocketMessage.type,
      action: websocketMessage.data.action,
      hasToken: !!websocketMessage.data.token,
      messageLength: websocketMessage.data.message?.length,
      correlationId,
    });

    const { type, data } = websocketMessage;
    const { action } = data;

    // Handle authentication
    if (type === 'auth') {
      return await handleAuthMessage(
        websocketMessage,
        connectionId,
        event,
        correlationId
      );
    }

    // Check if connection is authenticated for other actions
    const isAuthenticated = await isConnectionAuthenticated(connectionId);
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
    if (type === 'message') {
      return await handleChatMessage(
        websocketMessage,
        connectionId,
        event,
        correlationId
      );
    }

    // Handle ping messages
    if (type === 'ping') {
      return await handlePingMessageHandler(connectionId);
    }

    // Invalid action
    const error = createError(
      ErrorType.VALIDATION_ERROR,
      'Invalid action',
      'INVALID_ACTION',
      {
        expectedActions: VALID_ACTIONS,
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

// Export the handler wrapped with Middy middleware
export const handler = createWebSocketHandler(
  conversationHandler,
  commonSchemas.websocketMessage
);
