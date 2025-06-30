import { removeAuthenticatedConnection } from '@application/use-cases/remove-authenticated-connection';
import { removeConnection } from '@application/use-cases/remove-connection';
import { logger } from '@awslambdahackathon/utils/lambda';
import { container, ErrorContext } from '@config/container';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  CONFLICT_ERROR = 'CONFLICT_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  CIRCUIT_BREAKER_ERROR = 'CIRCUIT_BREAKER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class AppError extends Error {
  constructor(
    public readonly type: ErrorType,
    public readonly message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
    public readonly correlationId?: string,
    public readonly timestamp: Date = new Date()
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON(): Record<string, unknown> {
    return {
      type: this.type,
      message: this.message,
      code: this.code,
      details: this.details,
      correlationId: this.correlationId,
      timestamp: this.timestamp.toISOString(),
    };
  }
}

export interface ErrorCreator {
  createError(
    type: ErrorType,
    message: string,
    code: string,
    details?: Record<string, unknown>,
    correlationId?: string
  ): AppError;
}

export interface ErrorHandler {
  handleError(error: Error | AppError, context?: ErrorContext): AppError;
}

export interface ErrorResponseCreator {
  createErrorResponse(
    error: AppError,
    event?: APIGatewayProxyEvent
  ): APIGatewayProxyResult;
}

export interface WebSocketErrorHandler {
  handleWebSocketError(
    error: AppError,
    connectionId: string,
    event: APIGatewayProxyEvent
  ): Promise<void>;
}

export interface ErrorHandlingService
  extends ErrorCreator,
    ErrorHandler,
    ErrorResponseCreator,
    WebSocketErrorHandler {}

export class ApplicationErrorHandlingService implements ErrorHandlingService {
  createError(
    type: ErrorType,
    message: string,
    code: string,
    details?: Record<string, unknown>,
    correlationId?: string
  ): AppError {
    logger.debug('Creating application error', {
      type,
      message,
      code,
      details,
      correlationId,
    });

    return new AppError(type, message, code, details, correlationId);
  }

  handleError(error: Error | AppError, context?: ErrorContext): AppError {
    if (error instanceof AppError) {
      logger.warn('Handling application error', {
        error: error.toJSON(),
        context,
      });
      return error;
    }

    const appError = this.createError(
      ErrorType.INTERNAL_ERROR,
      error.message || 'An unexpected error occurred',
      'INTERNAL_ERROR',
      {
        originalError: error.name,
        stack: error.stack,
        ...context,
      },
      context?.correlationId
    );

    logger.error('Handling unexpected error', {
      error: appError.toJSON(),
      context,
    });

    return appError;
  }

  createErrorResponse(error: AppError): APIGatewayProxyResult {
    const statusCode = this.getHttpStatusCode(error.type);
    const body = JSON.stringify({
      error: {
        type: error.type,
        message: error.message,
        code: error.code,
        ...(error.details && { details: error.details }),
        ...(error.correlationId && { correlationId: error.correlationId }),
        timestamp: error.timestamp.toISOString(),
      },
    });

    logger.info('Creating error response', {
      statusCode,
      errorType: error.type,
      errorCode: error.code,
      correlationId: error.correlationId,
    });

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
          'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      },
      body,
    };
  }

  async handleWebSocketError(
    error: AppError,
    connectionId: string,
    event: APIGatewayProxyEvent
  ): Promise<void> {
    const startTime = Date.now();
    const correlationId = this.generateCorrelationId();

    logger.error('Handling WebSocket error', {
      connectionId,
      error: error.toJSON(),
      correlationId,
    });

    try {
      // 1. Send error message to WebSocket client
      await this.sendErrorMessageToClient(connectionId, event, error);

      // 2. Record error metrics
      await this.recordErrorMetrics(error, connectionId, correlationId);

      // 3. Clean up connection resources based on error type
      await this.cleanupConnectionResources(error, connectionId);

      // 4. Log comprehensive error details
      this.logErrorDetails(error, connectionId, correlationId);
    } catch (handlingError) {
      logger.error('Failed to handle WebSocket error', {
        originalError: error.toJSON(),
        handlingError:
          handlingError instanceof Error
            ? handlingError.message
            : String(handlingError),
        connectionId,
        correlationId,
      });
    } finally {
      const duration = Date.now() - startTime;
      logger.info('WebSocket error handling completed', {
        connectionId,
        errorType: error.type,
        duration,
        correlationId,
      });
    }
  }

  private async sendErrorMessageToClient(
    connectionId: string,
    event: APIGatewayProxyEvent,
    error: AppError
  ): Promise<void> {
    try {
      const webSocketService = container.createWebSocketMessageService(event);

      const errorMessage = this.getUserFriendlyErrorMessage(error);

      await webSocketService.sendErrorMessage(connectionId, errorMessage);

      logger.info('Error message sent to WebSocket client', {
        connectionId,
        errorType: error.type,
        userMessage: errorMessage,
      });
    } catch (sendError) {
      logger.error('Failed to send error message to WebSocket client', {
        connectionId,
        originalError: error.toJSON(),
        sendError:
          sendError instanceof Error ? sendError.message : String(sendError),
      });
    }
  }

  private async recordErrorMetrics(
    error: AppError,
    connectionId: string,
    correlationId: string
  ): Promise<void> {
    try {
      const metricsService = container.getMetricsService();

      // Record general error metrics for WebSocket errors
      await metricsService.recordErrorMetrics(
        error.type,
        'websocket_error_handling',
        {
          connectionId,
          correlationId,
          errorCode: error.code,
        }
      );

      logger.debug('Error metrics recorded', {
        connectionId,
        errorType: error.type,
        correlationId,
      });
    } catch (metricsError) {
      logger.error('Failed to record error metrics', {
        connectionId,
        originalError: error.toJSON(),
        metricsError:
          metricsError instanceof Error
            ? metricsError.message
            : String(metricsError),
      });
    }
  }

  private async cleanupConnectionResources(
    error: AppError,
    connectionId: string
  ): Promise<void> {
    try {
      // Determine if connection should be removed based on error type
      const shouldRemoveConnection = this.shouldRemoveConnection(error);

      if (shouldRemoveConnection) {
        logger.info('Removing connection due to error', {
          connectionId,
          errorType: error.type,
          reason: this.getRemovalReason(error),
        });

        // Try to remove authenticated connection first
        try {
          await removeAuthenticatedConnection(
            container.getAuthenticationService(),
            connectionId
          );
        } catch (authError) {
          logger.debug(
            'Failed to remove authenticated connection, trying regular connection',
            {
              connectionId,
              authError:
                authError instanceof Error
                  ? authError.message
                  : String(authError),
            }
          );

          // Fallback to removing regular connection
          await removeConnection(
            container.getConnectionService(),
            connectionId
          );
        }

        logger.info('Connection removed successfully', {
          connectionId,
          errorType: error.type,
        });
      } else {
        logger.debug('Connection kept active despite error', {
          connectionId,
          errorType: error.type,
          reason: 'Non-critical error',
        });
      }
    } catch (cleanupError) {
      logger.error('Failed to cleanup connection resources', {
        connectionId,
        originalError: error.toJSON(),
        cleanupError:
          cleanupError instanceof Error
            ? cleanupError.message
            : String(cleanupError),
      });
    }
  }

  private logErrorDetails(
    error: AppError,
    connectionId: string,
    correlationId: string
  ): void {
    const errorDetails = {
      connectionId,
      correlationId,
      errorType: error.type,
      errorCode: error.code,
      message: error.message,
      details: error.details,
      timestamp: error.timestamp.toISOString(),
      stack: error.stack,
    };

    // Log with appropriate level based on error type
    if (this.isCriticalError(error)) {
      logger.error('Critical WebSocket error occurred', errorDetails);
    } else if (this.isWarningError(error)) {
      logger.warn('WebSocket warning occurred', errorDetails);
    } else {
      logger.info('WebSocket error handled', errorDetails);
    }
  }

  private getUserFriendlyErrorMessage(error: AppError): string {
    switch (error.type) {
      case ErrorType.AUTHENTICATION_ERROR:
        return 'Authentication failed. Please reconnect with valid credentials.';
      case ErrorType.AUTHORIZATION_ERROR:
        return 'Access denied. You do not have permission to perform this action.';
      case ErrorType.VALIDATION_ERROR:
        return 'Invalid request format. Please check your message and try again.';
      case ErrorType.RATE_LIMIT_ERROR:
        return 'Too many requests. Please slow down and try again later.';
      case ErrorType.CIRCUIT_BREAKER_ERROR:
        return 'Service temporarily unavailable. Please try again in a moment.';
      case ErrorType.DATABASE_ERROR:
      case ErrorType.EXTERNAL_SERVICE_ERROR:
        return 'Service temporarily unavailable. Please try again.';
      case ErrorType.INTERNAL_ERROR:
      case ErrorType.UNKNOWN_ERROR:
      default:
        return 'An unexpected error occurred. Please try again or contact support.';
    }
  }

  private shouldRemoveConnection(error: AppError): boolean {
    // Remove connection for critical errors that indicate connection issues
    const criticalErrors = [
      ErrorType.AUTHENTICATION_ERROR,
      ErrorType.AUTHORIZATION_ERROR,
      ErrorType.CIRCUIT_BREAKER_ERROR,
      ErrorType.DATABASE_ERROR,
      ErrorType.EXTERNAL_SERVICE_ERROR,
    ];

    return criticalErrors.includes(error.type);
  }

  private getRemovalReason(error: AppError): string {
    switch (error.type) {
      case ErrorType.AUTHENTICATION_ERROR:
        return 'Authentication failed';
      case ErrorType.AUTHORIZATION_ERROR:
        return 'Authorization failed';
      case ErrorType.CIRCUIT_BREAKER_ERROR:
        return 'Service unavailable';
      case ErrorType.DATABASE_ERROR:
        return 'Database error';
      case ErrorType.EXTERNAL_SERVICE_ERROR:
        return 'External service error';
      default:
        return 'Critical error';
    }
  }

  private isCriticalError(error: AppError): boolean {
    const criticalErrors = [
      ErrorType.AUTHENTICATION_ERROR,
      ErrorType.AUTHORIZATION_ERROR,
      ErrorType.CIRCUIT_BREAKER_ERROR,
      ErrorType.DATABASE_ERROR,
      ErrorType.EXTERNAL_SERVICE_ERROR,
      ErrorType.INTERNAL_ERROR,
    ];

    return criticalErrors.includes(error.type);
  }

  private isWarningError(error: AppError): boolean {
    const warningErrors = [
      ErrorType.VALIDATION_ERROR,
      ErrorType.RATE_LIMIT_ERROR,
    ];

    return warningErrors.includes(error.type);
  }

  private generateCorrelationId(): string {
    return `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getHttpStatusCode(errorType: ErrorType): number {
    switch (errorType) {
      case ErrorType.VALIDATION_ERROR:
        return 400;
      case ErrorType.AUTHENTICATION_ERROR:
        return 401;
      case ErrorType.AUTHORIZATION_ERROR:
        return 403;
      case ErrorType.NOT_FOUND_ERROR:
        return 404;
      case ErrorType.CONFLICT_ERROR:
        return 409;
      case ErrorType.RATE_LIMIT_ERROR:
        return 429;
      case ErrorType.CIRCUIT_BREAKER_ERROR:
        return 503;
      case ErrorType.DATABASE_ERROR:
        return 503;
      case ErrorType.EXTERNAL_SERVICE_ERROR:
        return 502;
      case ErrorType.INTERNAL_ERROR:
      case ErrorType.UNKNOWN_ERROR:
      default:
        return 500;
    }
  }
}
