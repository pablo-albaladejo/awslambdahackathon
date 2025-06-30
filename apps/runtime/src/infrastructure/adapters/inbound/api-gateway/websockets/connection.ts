import { removeAuthenticatedConnection } from '@application/use-cases/remove-authenticated-connection';
import { removeConnection } from '@application/use-cases/remove-connection';
import { storeConnection } from '@application/use-cases/store-connection';
import {
  createSuccessResponse,
  createWebSocketHandler,
  logger,
  tracer,
} from '@awslambdahackathon/utils/lambda';
import { ERROR_CONSTANTS, WEBSOCKET_CONSTANTS } from '@config/constants';
import { container } from '@config/container';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { AuthenticationService } from '@/application/services/authentication-service';
import { ConnectionService } from '@/application/services/connection-service';
import { MetricsService } from '@/application/services/metrics-service';
import { PerformanceMonitoringService } from '@/application/services/performance-monitoring-service';
import {
  ErrorHandlingService,
  ErrorType,
} from '@/infrastructure/services/app-error-handling-service';

// Dependencies interface for the connection handler
interface ConnectionHandlerDependencies {
  connectionService: ConnectionService;
  authenticationService: AuthenticationService;
  errorHandlingService: ErrorHandlingService;
  performanceMonitoringService: PerformanceMonitoringService;
  metricsService: MetricsService;
}

// Factory function to create the handler with dependencies
export const createConnectionHandler = (
  dependencies: ConnectionHandlerDependencies
) => {
  return async (
    event: APIGatewayProxyEvent
  ): Promise<APIGatewayProxyResult> => {
    const {
      connectionService,
      authenticationService,
      errorHandlingService,
      performanceMonitoringService,
      metricsService,
    } = dependencies;

    // Start performance monitoring
    const performanceMonitor = performanceMonitoringService.startMonitoring(
      'websocket_connection',
      {
        connectionId: event.requestContext.connectionId,
        eventType: event.requestContext.eventType,
        requestId: event.requestContext.requestId,
        operation: 'websocket_connection',
        service: 'websocket',
      }
    );

    metricsService.recordWebSocketMetrics('connect', true);

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
        const error = errorHandlingService.createError(
          ErrorType.VALIDATION_ERROR,
          ERROR_CONSTANTS.MESSAGES.MISSING_CONNECTION_ID,
          ERROR_CONSTANTS.CODES.MISSING_CONNECTION_ID,
          { requestContext: event.requestContext }
        );

        logger.error('Missing connectionId in requestContext', {
          requestContext: event.requestContext,
        });

        performanceMonitor.complete(false);

        return errorHandlingService.createErrorResponse(error, event);
      }

      if (
        event.requestContext.eventType ===
        WEBSOCKET_CONSTANTS.EVENT_TYPES.CONNECT
      ) {
        try {
          await storeConnection(connectionService, connectionId);

          performanceMonitor.complete(true);

          return {
            statusCode: WEBSOCKET_CONSTANTS.STATUS_CODES.SUCCESS,
            headers: { 'Content-Type': 'application/json' },
            body: '',
          };
        } catch (error) {
          const appError = errorHandlingService.handleError(error as Error, {
            connectionId,
            action: 'connect',
            event,
          });

          performanceMonitor.complete(false);

          return errorHandlingService.createErrorResponse(appError, event);
        }
      }

      if (
        event.requestContext.eventType ===
        WEBSOCKET_CONSTANTS.EVENT_TYPES.DISCONNECT
      ) {
        try {
          await removeConnection(connectionService, connectionId);
          await removeAuthenticatedConnection(
            authenticationService,
            connectionId
          );

          performanceMonitor.complete(true);

          return createSuccessResponse({
            statusCode: WEBSOCKET_CONSTANTS.STATUS_CODES.SUCCESS,
            body: JSON.stringify({ message: 'Disconnected' }),
          });
        } catch (error) {
          const appError = errorHandlingService.handleError(error as Error, {
            connectionId,
            action: 'disconnect',
            event,
          });
          // For disconnect, we still want to return success even if cleanup fails
          logger.warn('Error during disconnect cleanup', {
            connectionId,
            error: appError.message,
          });

          performanceMonitor.complete(true);

          return createSuccessResponse({
            statusCode: WEBSOCKET_CONSTANTS.STATUS_CODES.SUCCESS,
            body: JSON.stringify({ message: 'Disconnected' }),
          });
        }
      }

      const error = errorHandlingService.createError(
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

      performanceMonitor.complete(false);

      return errorHandlingService.createErrorResponse(error, event);
    } catch (error) {
      const appError = errorHandlingService.handleError(error as Error, {
        requestId: event.requestContext.requestId,
        connectionId: event.requestContext.connectionId || 'unknown',
        action: 'websocket_connection',
        event,
      });

      performanceMonitor.complete(false);

      return errorHandlingService.createErrorResponse(appError, event);
    } finally {
      subsegment?.close();
    }
  };
};

// Create the handler with dependencies from container (for backward compatibility)
const connectionHandler = createConnectionHandler({
  connectionService: container.getConnectionService(),
  authenticationService: container.getAuthenticationService(),
  errorHandlingService: container.getErrorHandlingService(),
  performanceMonitoringService: container.getPerformanceMonitoringService(),
  metricsService: container.getMetricsService(),
});

// Export the handler wrapped with Middy middleware
export const handler = createWebSocketHandler(connectionHandler);
