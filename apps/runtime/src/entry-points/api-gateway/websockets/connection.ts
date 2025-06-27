import {
  commonSchemas,
  createSuccessResponse,
  createWebSocketHandler,
  logger,
  metrics,
  tracer,
} from '@awslambdahackathon/utils/lambda';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { removeAuthenticatedConnection } from '../../../application/use-cases/remove-authenticated-connection';
import { removeConnection } from '../../../application/use-cases/remove-connection';
import { storeConnection } from '../../../application/use-cases/store-connection';
import {
  ERROR_CONSTANTS,
  METRIC_CONSTANTS,
  WEBSOCKET_CONSTANTS,
} from '../../../config/constants';
import { ConnectionService } from '../../../services/connection-service';
import {
  createError,
  createErrorResponse,
  ErrorType,
  handleError,
} from '../../../services/error-handling-service';

const connectionService = new ConnectionService();

const connectionHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  metrics.addMetric(
    METRIC_CONSTANTS.NAMES.WEBSOCKET_REQUEST,
    METRIC_CONSTANTS.UNITS.COUNT,
    1
  );
  metrics.addDimension(
    METRIC_CONSTANTS.DIMENSIONS.ENVIRONMENT,
    process.env.ENVIRONMENT || 'dev'
  );

  logger.info('WebSocket connection event received', {
    httpMethod: event.httpMethod,
    path: event.path,
    requestId: event.requestContext.requestId,
    eventType: event.requestContext.eventType,
  });

  const segment = tracer.getSegment();
  const subsegment = segment?.addNewSubsegment('websocket-connection-logic');

  try {
    const connectionId = event.requestContext.connectionId;
    if (!connectionId) {
      const error = createError(
        ErrorType.VALIDATION_ERROR,
        ERROR_CONSTANTS.MESSAGES.MISSING_CONNECTION_ID,
        ERROR_CONSTANTS.CODES.MISSING_CONNECTION_ID,
        { requestContext: event.requestContext }
      );

      logger.error('Missing connectionId in requestContext', {
        requestContext: event.requestContext,
      });

      return createErrorResponse(error, event);
    }

    if (
      event.requestContext.eventType === WEBSOCKET_CONSTANTS.EVENT_TYPES.CONNECT
    ) {
      try {
        await storeConnection(connectionService, connectionId);
        return {
          statusCode: WEBSOCKET_CONSTANTS.STATUS_CODES.SUCCESS,
          headers: { 'Content-Type': 'application/json' },
          body: '',
        };
      } catch (error) {
        const appError = handleError(error as Error, {
          connectionId,
          action: 'connect',
          event,
        });
        return createErrorResponse(appError, event);
      }
    }

    if (
      event.requestContext.eventType ===
      WEBSOCKET_CONSTANTS.EVENT_TYPES.DISCONNECT
    ) {
      try {
        await removeConnection(connectionService, connectionId);
        await removeAuthenticatedConnection(connectionId);
        return createSuccessResponse({
          statusCode: WEBSOCKET_CONSTANTS.STATUS_CODES.SUCCESS,
          body: JSON.stringify({ message: 'Disconnected' }),
        });
      } catch (error) {
        const appError = handleError(error as Error, {
          connectionId,
          action: 'disconnect',
          event,
        });
        // For disconnect, we still want to return success even if cleanup fails
        logger.warn('Error during disconnect cleanup', {
          connectionId,
          error: appError.message,
        });
        return createSuccessResponse({
          statusCode: WEBSOCKET_CONSTANTS.STATUS_CODES.SUCCESS,
          body: JSON.stringify({ message: 'Disconnected' }),
        });
      }
    }

    const error = createError(
      ErrorType.VALIDATION_ERROR,
      ERROR_CONSTANTS.MESSAGES.INVALID_EVENT_TYPE,
      ERROR_CONSTANTS.CODES.INVALID_EVENT_TYPE,
      {
        expectedTypes: [
          WEBSOCKET_CONSTANTS.EVENT_TYPES.CONNECT,
          WEBSOCKET_CONSTANTS.EVENT_TYPES.DISCONNECT,
        ],
        actualType: event.requestContext.eventType,
      }
    );

    logger.error('Invalid event type for connection handler', {
      eventType: event.requestContext.eventType,
    });

    return createErrorResponse(error, event);
  } catch (error) {
    const appError = handleError(error as Error, {
      requestId: event.requestContext.requestId,
      connectionId: event.requestContext.connectionId,
      action: 'websocket_connection',
      event,
    });

    return createErrorResponse(appError, event);
  } finally {
    subsegment?.close();
  }
};

// Export the handler wrapped with Middy middleware
export const handler = createWebSocketHandler(
  connectionHandler,
  commonSchemas.websocketConnection
);
