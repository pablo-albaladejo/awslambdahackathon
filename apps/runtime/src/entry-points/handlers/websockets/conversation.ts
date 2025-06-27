import {
  createSuccessResponse,
  logger,
  metrics,
  tracer,
} from '@awslambdahackathon/utils/lambda';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { authenticateUser } from '../../../application/use-cases/authenticate-user';
import { isConnectionAuthenticated } from '../../../application/use-cases/check-authenticated-connection';
import { handlePingMessage } from '../../../application/use-cases/handle-ping-message';
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

        await websocketMessageService.sendAuthResponse(
          connectionId,
          event,
          true,
          {
            userId: safeUserId,
            username: authResult.user.username,
          }
        );

        logger.info('WebSocket authentication successful', {
          connectionId,
          userId: authResult.user.userId,
          correlationId,
        });

        await metricsService.recordBusinessMetrics(
          'authentication_success',
          1,
          {
            connectionId,
            userId: authResult.user.userId,
          }
        );
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

        await metricsService.recordBusinessMetrics(
          'authentication_failure',
          1,
          {
            connectionId,
            errorType: authResult.error || 'UNKNOWN_ERROR',
          }
        );
      }

      return createSuccessResponse({
        statusCode: 200,
        body: '',
      });
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
      const { message: echoMessage, sessionId: currentSessionId } =
        await sendChatMessage(chatService, {
          connectionId,
          message: message ?? '',
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
    }

    // Handle ping messages
    if (type === 'ping') {
      await handlePingMessage(connectionId);
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
