import {
  createSuccessResponse,
  createWebSocketHandler,
  generateCorrelationId,
  logger,
} from '@awslambdahackathon/utils/lambda';
import {
  CORRELATION_CONSTANTS,
  ERROR_CONSTANTS,
  METRIC_CONSTANTS,
  WEBSOCKET_CONSTANTS,
} from '@config/constants';
import { container } from '@config/container';
import { ConnectionRepository } from '@domain/repositories/connection';
import { ConnectionId, SessionId } from '@domain/value-objects';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// Type guards for safe type checking
function hasUserMethods(obj: unknown): obj is {
  getUserId(): string;
  getUsername(): string;
  getId(): { getValue(): string };
  getEmail?: () => string;
  getGroups?: () => string[];
} {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'getUserId' in obj &&
    'getUsername' in obj &&
    'getId' in obj &&
    typeof (obj as Record<string, unknown>).getUserId === 'function' &&
    typeof (obj as Record<string, unknown>).getUsername === 'function' &&
    typeof (obj as Record<string, unknown>).getId === 'function' &&
    ('getEmail' in obj || 'getGroups' in obj)
  );
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

interface WebSocketContext {
  parsedBody?: WebSocketMessage;
}

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
  context?: WebSocketContext
): WebSocketMessage => {
  if (!event.body) {
    throw new Error(ERROR_CONSTANTS.MESSAGES.MISSING_BODY);
  }

  // Use parsed body from middleware if available (preferred)
  if (context?.parsedBody) {
    return context.parsedBody;
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

// Safe wrapper functions
function createWebSocketService(event: APIGatewayProxyEvent) {
  return container.createCommunicationService(event as never);
}

function storeAuthenticatedConnection(connectionId: string, user: unknown) {
  return container.getAuthenticationService().storeAuthenticatedConnection({
    connectionId: ConnectionId.create(connectionId),
    user: user as never,
  });
}

// Helper function to associate connection with session
async function associateConnectionWithSession(
  connectionId: string,
  sessionId: string,
  correlationId: string
): Promise<void> {
  try {
    const connectionRepository = container.get<ConnectionRepository>(
      'ConnectionRepository'
    );
    const connection = await connectionRepository.findById(
      ConnectionId.create(connectionId)
    );

    if (connection && !connection.getSessionId()) {
      // Only associate if connection doesn't already have a session
      const updatedConnection = connection.associateWithSession(
        SessionId.create(sessionId)
      );
      await connectionRepository.save(updatedConnection);

      logger.info('Associated connection with session', {
        connectionId,
        sessionId,
        correlationId,
      });
    }
  } catch (error) {
    logger.warn('Failed to associate connection with session', {
      connectionId,
      sessionId,
      error: error instanceof Error ? error.message : String(error),
      correlationId,
    });
    // Don't fail the message sending if session association fails
  }
}

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
    tokenLength: token ? token.length : 0,
    correlationId,
  });

  try {
    const authenticateUserUseCase = container.getAuthenticateUserUseCase();

    logger.info('Executing authentication use case', {
      connectionId,
      correlationId,
    });

    const authResult = await authenticateUserUseCase.execute({
      token: typeof token === 'string' ? token : '',
    });

    logger.info('Authentication use case completed', {
      connectionId,
      success: authResult.success,
      hasUser: !!authResult.user,
      error: authResult.error,
      correlationId,
    });

    if (
      authResult.success &&
      authResult.user &&
      hasUserMethods(authResult.user)
    ) {
      const safeUserId = authResult.user.getUserId();

      logger.info('Authentication successful, storing connection', {
        connectionId,
        userId: safeUserId,
        username: authResult.user.getUsername(),
        correlationId,
      });

      await storeAuthenticatedConnection(connectionId, authResult.user);

      await createWebSocketService(event).sendAuthenticationResponse(
        ConnectionId.create(connectionId),
        {
          success: true,
          user: {
            id: safeUserId,
            username: authResult.user.getUsername(),
            email: authResult.user.getEmail?.() || '',
            groups: authResult.user.getGroups?.() || [],
          },
        }
      );

      logger.info('WebSocket authentication successful', {
        connectionId,
        userId: safeUserId,
        correlationId,
      });

      await container
        .getMetricsService()
        .recordBusinessMetrics(
          METRIC_CONSTANTS.NAMES.AUTHENTICATION_SUCCESS,
          1,
          {
            connectionId,
          }
        );
    } else {
      logger.warn('Authentication failed', {
        connectionId,
        success: authResult.success,
        hasUser: !!authResult.user,
        error: authResult.error,
        userMethods: authResult.user ? hasUserMethods(authResult.user) : false,
        correlationId,
      });

      await createWebSocketService(event).sendAuthenticationResponse(
        ConnectionId.create(connectionId),
        {
          success: false,
          error: authResult.error || 'Authentication failed',
        }
      );

      await container
        .getMetricsService()
        .recordBusinessMetrics(
          METRIC_CONSTANTS.NAMES.AUTHENTICATION_FAILURE,
          1,
          {
            connectionId,
            errorType: authResult.error || 'UNKNOWN_ERROR',
          }
        );
    }
  } catch (error) {
    logger.error('Authentication process failed with exception', {
      connectionId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      correlationId,
    });

    await createWebSocketService(event).sendAuthenticationResponse(
      ConnectionId.create(connectionId),
      {
        success: false,
        error: 'Internal authentication error',
      }
    );

    await container
      .getMetricsService()
      .recordBusinessMetrics(METRIC_CONSTANTS.NAMES.AUTHENTICATION_FAILURE, 1, {
        connectionId,
        errorType: 'EXCEPTION',
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

  // Associate connection with session if sessionId is provided
  if (sessionId) {
    await associateConnectionWithSession(
      connectionId,
      sessionId,
      correlationId
    );
  }

  const sendChatMessageUseCase = container.getSendChatMessageUseCase();
  const result = await sendChatMessageUseCase.execute({
    content: chatMessage ?? '',
    sessionId: sessionId ?? '',
    userId: user.getId().getValue(),
    connectionId,
  });

  if (!result.success) {
    logger.error('Failed to send chat message', {
      error: result.error,
      connectionId,
    });
    throw new Error(result.error || 'Failed to send chat message');
  }

  await createWebSocketService(event).sendChatMessageResponse(
    ConnectionId.create(connectionId),
    {
      messageId: crypto.randomUUID(),
      content: result.message?.getContent() ?? '',
      userId: user.getId().getValue(),
      username: user.getUsername(),
      timestamp: new Date(),
      sessionId: result.message?.getSessionId().getValue() ?? '',
      isEcho: true,
    }
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
  const handlePingMessageUseCase = container.getHandlePingMessageUseCase();
  await handlePingMessageUseCase.execute({ connectionId });
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
  const correlationId = generateCorrelationId(
    CORRELATION_CONSTANTS.PREFIXES.CONVERSATION
  );

  // Start performance monitoring
  const performanceMonitor = container
    .getPerformanceMonitoringService()
    .startMonitoring('websocket_conversation', {
      connectionId: event.requestContext.connectionId,
      eventType: event.requestContext.eventType,
      requestId: event.requestContext.requestId,
      operation: 'websocket_conversation',
      service: 'websocket',
    });

  try {
    const connectionId = validateConnectionId(event);
    const message = parseWebSocketMessage(event, context as WebSocketContext);

    // Check if connection is authenticated for non-auth messages
    if (message.type !== 'auth') {
      logger.info('Checking authentication for non-auth message', {
        connectionId,
        messageType: message.type,
        correlationId,
      });

      const checkAuthenticatedConnectionUseCase =
        container.getCheckAuthenticatedConnectionUseCase();
      const isAuthenticated = await checkAuthenticatedConnectionUseCase.execute(
        {
          connectionId,
        }
      );

      logger.info('Authentication check completed', {
        connectionId,
        isAuthenticatedSuccess: isAuthenticated.success,
        isAuthenticatedValue: isAuthenticated.isAuthenticated,
        correlationId,
      });

      if (!isAuthenticated.success || !isAuthenticated.isAuthenticated) {
        logger.error('WebSocket authentication failed', {
          connectionId,
          checkSuccess: isAuthenticated.success,
          isAuthenticated: isAuthenticated.isAuthenticated,
          messageType: message.type,
          correlationId,
        });
        throw new Error('Connection not authenticated');
      }

      logger.info('Authentication check passed', {
        connectionId,
        messageType: message.type,
        correlationId,
      });
    }

    let response: APIGatewayProxyResult;

    switch (message.type) {
      case 'auth':
        response = await handleAuthMessage(
          message,
          connectionId,
          event,
          correlationId
        );
        break;
      case 'message':
        response = await handleChatMessage(
          message,
          connectionId,
          event,
          correlationId
        );
        break;
      case 'ping':
        response = await handlePingMessageHandler(connectionId);
        break;
      default:
        throw new Error(`Invalid message type: ${message.type}`);
    }

    performanceMonitor.complete(true);
    return response;
  } catch (error) {
    const appError = container
      .getErrorHandlingService()
      .handleError(error as Error, {
        requestId: event.requestContext.requestId,
        connectionId: event.requestContext.connectionId || 'unknown',
        action: 'websocket_conversation',
        event,
      });

    performanceMonitor.complete(false);

    await container
      .getErrorHandlingService()
      .handleWebSocketError(
        appError,
        event.requestContext.connectionId || 'unknown',
        event
      );

    return container
      .getErrorHandlingService()
      .createErrorResponse(appError, event) as APIGatewayProxyResult;
  }
};

// Export the handler wrapped with Middy middleware
export const handler = createWebSocketHandler(conversationHandler);
