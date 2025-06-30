import { authenticateUser } from '@application/use-cases/authenticate-user';
import { isConnectionAuthenticated } from '@application/use-cases/check-authenticated-connection';
import { handlePingMessage as handlePingMessageUseCase } from '@application/use-cases/handle-ping-message';
import { sendChatMessage } from '@application/use-cases/send-chat-message';
import {
  commonSchemas,
  createSuccessResponse,
  createWebSocketHandler,
  generateCorrelationId,
  logger,
  metrics,
  tracer,
} from '@awslambdahackathon/utils/lambda';
import {
  CORRELATION_CONSTANTS,
  ERROR_CONSTANTS,
  METRIC_CONSTANTS,
  WEBSOCKET_CONSTANTS,
} from '@config/constants';
import { container } from '@config/container';
import { ConnectionId } from '@domain/value-objects/connection-id';
import { ErrorType } from '@infrastructure/services/error-handling-service';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

interface WebSocketMessage {
  type: 'auth' | 'message' | 'ping';
  data: {
    action: string;
    message?: string;
    sessionId?: string;
    token?: string;
  };
}

// Constants for actions
const VALID_ACTIONS = [
  WEBSOCKET_CONSTANTS.ACTIONS.AUTHENTICATE,
  WEBSOCKET_CONSTANTS.ACTIONS.SEND_MESSAGE,
] as const;

// Helper function to validate connection ID
const validateConnectionId = (event: APIGatewayProxyEvent): string => {
  const connectionId = event.requestContext.connectionId;
  if (!connectionId) {
    throw new Error(ERROR_CONSTANTS.MESSAGES.MISSING_CONNECTION_ID);
  }
  return connectionId;
};

// Helper function to parse WebSocket message
const parseWebSocketMessage = (
  event: APIGatewayProxyEvent,
  context?: { parsedBody?: WebSocketMessage }
): WebSocketMessage => {
  if (!event.body) {
    throw new Error(ERROR_CONSTANTS.MESSAGES.MISSING_BODY);
  }

  // Use parsed body from middleware if available (preferred)
  if (context?.parsedBody) {
    return context.parsedBody as WebSocketMessage;
  }

  // Manual parsing as fallback (should rarely happen with Middy validation)
  try {
    const parsedBody = JSON.parse(event.body);

    // Basic structure validation only (detailed validation handled by Middy)
    if (!parsedBody.type || !parsedBody.data) {
      throw new Error(ERROR_CONSTANTS.MESSAGES.INVALID_MESSAGE_FORMAT);
    }

    return parsedBody as WebSocketMessage;
  } catch (parseError) {
    if (parseError instanceof Error) {
      throw parseError;
    }
    throw new Error(ERROR_CONSTANTS.MESSAGES.INVALID_JSON);
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

  if (action !== WEBSOCKET_CONSTANTS.ACTIONS.AUTHENTICATE) {
    throw new Error(`Invalid action for auth message: ${action}`);
  }

  logger.info('Received authentication message', {
    connectionId,
    hasToken: !!token,
    correlationId,
  });

  const authResult = await authenticateUser(
    container.getAuthenticationService(),
    typeof token === 'string' ? token : ''
  );

  if (authResult.success && authResult.user) {
    const safeUserId = authResult.user.getUserId();

    await container.getAuthenticationService().storeAuthenticatedConnection({
      connectionId: ConnectionId.create(connectionId),
      user: authResult.user,
    });

    await container
      .getWebSocketMessageService()
      .sendAuthResponse(connectionId, event, true, {
        userId: safeUserId,
        username: authResult.user.getUsername(),
      });

    logger.info('WebSocket authentication successful', {
      connectionId,
      userId: safeUserId,
      correlationId,
    });

    await container
      .getMetricsService()
      .recordBusinessMetrics(METRIC_CONSTANTS.NAMES.AUTHENTICATION_SUCCESS, 1, {
        connectionId,
        userId: safeUserId,
      });
  } else {
    await container
      .getWebSocketMessageService()
      .sendAuthResponse(connectionId, event, false, {
        error: authResult.error,
      });

    logger.error('WebSocket authentication failed', {
      connectionId,
      error: authResult.error,
      correlationId,
    });

    await container
      .getMetricsService()
      .recordBusinessMetrics(METRIC_CONSTANTS.NAMES.AUTHENTICATION_FAILURE, 1, {
        connectionId,
        errorType: authResult.error || 'UNKNOWN_ERROR',
      });
  }

  return createSuccessResponse({
    statusCode: WEBSOCKET_CONSTANTS.STATUS_CODES.SUCCESS,
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

  if (action !== WEBSOCKET_CONSTANTS.ACTIONS.SEND_MESSAGE) {
    throw new Error(`Invalid action for message: ${action}`);
  }

  logger.info('Received chat message', {
    connectionId,
    sessionId,
    messageLength: chatMessage?.length,
    correlationId,
  });

  // Get user from connection to provide userId
  const user = await container
    .getAuthenticationService()
    .getUserFromConnection(ConnectionId.create(connectionId));

  if (!user) {
    logger.error('User not found for connection', { connectionId });
    throw new Error('User not found for connection');
  }

  const result = await sendChatMessage(container.getChatService(), {
    connectionId,
    message: chatMessage ?? '',
    sessionId,
    userId: user.getId().getValue(),
  });

  if (!result.success) {
    logger.error('Failed to send chat message', {
      error: result.error,
      connectionId,
    });
    throw new Error(result.error || 'Failed to send chat message');
  }

  await container.getWebSocketMessageService().sendChatResponse(
    connectionId,
    event,
    result.message!,
    result.sessionId!,
    true // isEcho
  );

  return createSuccessResponse({
    statusCode: WEBSOCKET_CONSTANTS.STATUS_CODES.SUCCESS,
    body: '',
  });
};

// Handler for ping messages
const handlePingMessageHandler = async (
  connectionId: string
): Promise<APIGatewayProxyResult> => {
  await handlePingMessageUseCase(connectionId);
  await container
    .getMetricsService()
    .recordWebSocketMetrics(METRIC_CONSTANTS.NAMES.PING, true, 0);

  return createSuccessResponse({
    statusCode: WEBSOCKET_CONSTANTS.STATUS_CODES.SUCCESS,
    body: '',
  });
};

// Main conversation handler
const conversationHandler = async (
  event: APIGatewayProxyEvent,
  context?: unknown
): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  const correlationId = generateCorrelationId(
    CORRELATION_CONSTANTS.PREFIXES.CONVERSATION
  );

  // Start performance monitoring
  const performanceMonitor = container
    .getPerformanceMonitoringService()
    .startMonitoring('websocket_conversation', {
      connectionId: event.requestContext.connectionId,
      operation: 'websocket_conversation',
      service: 'websocket',
      correlationId,
    });

  metrics.addMetric(
    METRIC_CONSTANTS.NAMES.WEBSOCKET_REQUEST,
    METRIC_CONSTANTS.UNITS.COUNT,
    1
  );
  metrics.addDimension(
    METRIC_CONSTANTS.DIMENSIONS.ENVIRONMENT,
    process.env.ENVIRONMENT || 'dev'
  );

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

  // Example: Get circuit breaker statistics for monitoring
  const circuitBreakerStats = container
    .getCircuitBreakerService()
    .getCircuitBreakerStats('cognito', 'verifyJWT');
  if (circuitBreakerStats) {
    logger.info('Circuit breaker status', {
      service: 'cognito',
      operation: 'verifyJWT',
      state: circuitBreakerStats.state,
      failureCount: circuitBreakerStats.failureCount,
      successCount: circuitBreakerStats.successCount,
    });
  }

  try {
    logger.info('WebSocket conversation event received', {
      connectionId,
      eventType: event.requestContext.eventType,
      routeKey: event.requestContext.routeKey,
      correlationId,
    });

    // Parse and validate the WebSocket message
    const websocketMessage = parseWebSocketMessage(
      event,
      context as { parsedBody?: WebSocketMessage }
    );

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
    if (type === WEBSOCKET_CONSTANTS.MESSAGE_TYPES.AUTH) {
      const result = await handleAuthMessage(
        websocketMessage,
        connectionId,
        event,
        correlationId
      );
      performanceMonitor.complete(true, {
        messageType: 'auth',
        action: data.action,
        hasToken: !!data.token,
      });
      return result;
    }

    // Check if connection is authenticated for other actions
    const isAuthenticated = await isConnectionAuthenticated(
      container.getAuthenticationService(),
      connectionId
    );
    logger.info('Authentication status for connection', {
      connectionId,
      isAuthenticated,
      action,
      type,
      correlationId,
    });

    if (!isAuthenticated) {
      const error = container
        .getErrorHandlingService()
        .createError(
          ErrorType.AUTHENTICATION_ERROR,
          ERROR_CONSTANTS.MESSAGES.AUTHENTICATION_REQUIRED,
          ERROR_CONSTANTS.CODES.UNAUTHENTICATED_CONNECTION,
          { connectionId, action }
        );

      logger.error('Unauthenticated connection attempting to send message', {
        connectionId,
        action,
        correlationId,
      });

      await container
        .getMetricsService()
        .recordErrorMetrics(
          ERROR_CONSTANTS.CODES.UNAUTHENTICATED_CONNECTION,
          'websocket_conversation',
          {
            connectionId,
            action,
          }
        );

      await container
        .getErrorHandlingService()
        .handleWebSocketError(error, connectionId, event);

      performanceMonitor.complete(false, {
        messageType: type,
        action,
        error: 'UNAUTHENTICATED_CONNECTION',
      });

      return createSuccessResponse({
        statusCode: WEBSOCKET_CONSTANTS.STATUS_CODES.SUCCESS,
        body: '',
      });
    }

    // Handle regular messages
    if (type === WEBSOCKET_CONSTANTS.MESSAGE_TYPES.MESSAGE) {
      const result = await handleChatMessage(
        websocketMessage,
        connectionId,
        event,
        correlationId
      );
      performanceMonitor.complete(true, {
        messageType: 'message',
        action: data.action,
        messageLength: data.message?.length,
        sessionId: data.sessionId,
      });
      return result;
    }

    // Handle ping messages
    if (type === WEBSOCKET_CONSTANTS.MESSAGE_TYPES.PING) {
      const result = await handlePingMessageHandler(connectionId);
      performanceMonitor.complete(true, {
        messageType: 'ping',
        action: data.action,
      });
      return result;
    }

    // Invalid action
    const error = container
      .getErrorHandlingService()
      .createError(
        ErrorType.VALIDATION_ERROR,
        ERROR_CONSTANTS.MESSAGES.INVALID_ACTION,
        ERROR_CONSTANTS.CODES.INVALID_ACTION,
        {
          expectedActions: VALID_ACTIONS,
          actualAction: action,
        }
      );

    logger.error('Invalid action in WebSocket message', {
      action,
      correlationId,
    });

    await container
      .getMetricsService()
      .recordErrorMetrics(
        ERROR_CONSTANTS.CODES.INVALID_ACTION,
        'websocket_conversation',
        {
          connectionId,
          action,
        }
      );

    performanceMonitor.complete(false, {
      messageType: type,
      action,
      error: 'INVALID_ACTION',
    });

    return container
      .getErrorHandlingService()
      .createErrorResponse(error, event);
  } catch (error) {
    const appError = container
      .getErrorHandlingService()
      .handleError(error as Error, {
        requestId: event.requestContext.requestId,
        connectionId: event.requestContext.connectionId || 'unknown',
        action: 'websocket_conversation',
        event,
      });

    await container
      .getMetricsService()
      .recordErrorMetrics(
        ERROR_CONSTANTS.CODES.UNEXPECTED_ERROR,
        'websocket_conversation',
        {
          connectionId,
          errorType: appError.type,
        }
      );

    performanceMonitor.complete(false, {
      messageType: 'unknown',
      action: 'unknown',
      error: appError.type,
      errorMessage: appError.message,
    });

    return container
      .getErrorHandlingService()
      .createErrorResponse(appError, event);
  } finally {
    const duration = Date.now() - startTime;
    await container
      .getMetricsService()
      .recordWebSocketMetrics(
        METRIC_CONSTANTS.NAMES.WEBSOCKET_MESSAGE,
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
