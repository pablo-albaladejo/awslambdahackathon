import { ErrorDtoMapper } from '@application/mappers/error-dto.mapper';
import { logger } from '@awslambdahackathon/utils/lambda';
import { container } from '@config/container';
import { ErrorContext } from '@domain/services/error-handling-service';
import { ConnectionId } from '@domain/value-objects';
import {
  AwsLambdaResponseAdapter,
  LambdaEvent,
  LambdaResponse,
} from '@infrastructure/adapters/outbound/lambda';
import { z } from 'zod';

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
  createErrorResponse(error: AppError, _event?: LambdaEvent): LambdaResponse;
}

export interface WebSocketErrorHandler {
  handleWebSocketError(
    error: AppError,
    connectionId: string,
    event: LambdaEvent
  ): Promise<void>;
}

export interface ErrorHandlingService
  extends ErrorCreator,
    ErrorHandler,
    ErrorResponseCreator,
    WebSocketErrorHandler {}

export class ApplicationErrorHandlingService implements ErrorHandlingService {
  private readonly responseAdapter: AwsLambdaResponseAdapter;

  constructor() {
    this.responseAdapter = new AwsLambdaResponseAdapter();
  }

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

    let errorType = ErrorType.INTERNAL_ERROR;
    let errorCode = 'INTERNAL_ERROR';
    let details: Record<string, unknown> | undefined = {
      originalError: error.name,
      stack: error.stack,
      ...context,
    };

    if (error instanceof z.ZodError) {
      errorType = ErrorType.VALIDATION_ERROR;
      errorCode = 'VALIDATION_ERROR';
      details = {
        issues: error.errors,
        ...context,
      };
    }

    const appError = this.createError(
      errorType,
      error.message || 'An unexpected error occurred',
      errorCode,
      details,
      context?.correlationId as string
    );

    logger.error('Handling unexpected error', {
      error: ErrorDtoMapper.unknownErrorToDto(
        appError,
        this.isDevEnvironment()
      ),
      context,
    });

    return appError;
  }

  createErrorResponse(error: AppError, _event?: LambdaEvent): LambdaResponse {
    // Using void to indicate intentionally unused parameter
    void _event;

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
    event: LambdaEvent
  ): Promise<void> {
    const startTime = Date.now();
    const correlationId = this.generateCorrelationId();

    logger.error('Handling WebSocket error', {
      connectionId,
      error: ErrorDtoMapper.unknownErrorToDto(error, this.isDevEnvironment()),
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
        originalError: ErrorDtoMapper.unknownErrorToDto(
          error,
          this.isDevEnvironment()
        ),
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
        duration,
        correlationId,
      });
    }
  }

  private async sendErrorMessageToClient(
    connectionId: string,
    event: LambdaEvent,
    error: AppError
  ): Promise<void> {
    try {
      // Create a mock WebSocketEvent for the communication service
      const webSocketEvent = {
        requestContext: event.requestContext,
        body: event.body,
        headers: event.headers,
        // Add required properties for APIGatewayProxyEvent compatibility
        httpMethod: 'POST',
        isBase64Encoded: false,
        multiValueHeaders: {},
        multiValueQueryStringParameters: null,
        path: '',
        pathParameters: null,
        queryStringParameters: null,
        resource: '',
        stageVariables: null,
      };

      const communicationService = container.createCommunicationService(
        webSocketEvent as never
      );

      const errorMessage = this.getUserFriendlyErrorMessage(error);

      // Use correct WebSocket message structure that follows ErrorSchema
      await communicationService.sendMessage(
        ConnectionId.create(connectionId),
        {
          type: 'error',
          timestamp: new Date(),
          data: {
            code: error.code,
            message: errorMessage,
            timestamp: error.timestamp.toISOString(), // Required by ErrorSchema
            details: {
              errorType: error.type,
              correlationId: error.correlationId,
              ...(error.details || {}),
            },
          },
        }
      );

      logger.info('Error message sent to WebSocket client', {
        connectionId,
        errorType: error.type,
        userMessage: errorMessage,
      });
    } catch (sendError) {
      logger.error('Failed to send error message to WebSocket client', {
        connectionId,
        originalError: ErrorDtoMapper.unknownErrorToDto(
          error,
          this.isDevEnvironment()
        ),
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
        }
      );

      // Record specific error metrics based on error type
      if (this.isCriticalError(error)) {
        await metricsService.recordBusinessMetrics('critical_error', 1, {
          errorType: error.type,
          connectionId,
        });
      } else if (this.isWarningError(error)) {
        await metricsService.recordBusinessMetrics('warning_error', 1, {
          errorType: error.type,
          connectionId,
        });
      }
    } catch (metricsError) {
      logger.error('Failed to record error metrics', {
        connectionId,
        originalError: ErrorDtoMapper.unknownErrorToDto(
          error,
          this.isDevEnvironment()
        ),
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
      if (this.shouldRemoveConnection(error)) {
        const reason = this.getRemovalReason(error);
        logger.info('Cleaning up connection resources', {
          connectionId,
          reason,
          errorType: error.type,
        });

        const removeConnectionUseCase = container.getRemoveConnectionUseCase();
        const removeAuthenticatedConnectionUseCase =
          container.getRemoveAuthenticatedConnectionUseCase();

        await removeConnectionUseCase.execute({ connectionId });
        await removeAuthenticatedConnectionUseCase.execute({ connectionId });

        logger.info('Successfully cleaned up connection resources', {
          connectionId,
          reason,
        });
      }
    } catch (cleanupError) {
      logger.error('Failed to clean up connection resources', {
        connectionId,
        originalError: ErrorDtoMapper.unknownErrorToDto(
          error,
          this.isDevEnvironment()
        ),
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
      type: error.type,
      message: error.message,
      code: error.code,
      details: error.details,
      timestamp: error.timestamp,
      connectionId,
      correlationId,
    };

    if (this.isCriticalError(error)) {
      logger.error('Critical error occurred', errorDetails);
    } else if (this.isWarningError(error)) {
      logger.warn('Warning error occurred', errorDetails);
    } else {
      logger.info('Error occurred', errorDetails);
    }
  }

  private getUserFriendlyErrorMessage(error: AppError): string {
    switch (error.type) {
      case ErrorType.VALIDATION_ERROR:
        return 'Invalid request format or parameters';
      case ErrorType.AUTHENTICATION_ERROR:
        return 'Authentication failed';
      case ErrorType.AUTHORIZATION_ERROR:
        return 'Not authorized to perform this action';
      case ErrorType.NOT_FOUND_ERROR:
        return 'Requested resource not found';
      case ErrorType.CONFLICT_ERROR:
        return 'Operation conflicts with existing data';
      case ErrorType.RATE_LIMIT_ERROR:
        return 'Too many requests, please try again later';
      case ErrorType.CIRCUIT_BREAKER_ERROR:
        return 'Service temporarily unavailable';
      case ErrorType.DATABASE_ERROR:
      case ErrorType.EXTERNAL_SERVICE_ERROR:
      case ErrorType.INTERNAL_ERROR:
        return 'Internal server error';
      default:
        return 'An unexpected error occurred';
    }
  }

  private shouldRemoveConnection(error: AppError): boolean {
    return (
      error.type === ErrorType.AUTHENTICATION_ERROR ||
      error.type === ErrorType.AUTHORIZATION_ERROR ||
      error.type === ErrorType.RATE_LIMIT_ERROR ||
      this.isCriticalError(error)
    );
  }

  private getRemovalReason(error: AppError): string {
    switch (error.type) {
      case ErrorType.AUTHENTICATION_ERROR:
        return 'authentication_failure';
      case ErrorType.AUTHORIZATION_ERROR:
        return 'authorization_failure';
      case ErrorType.RATE_LIMIT_ERROR:
        return 'rate_limit_exceeded';
      default:
        return 'critical_error';
    }
  }

  private isCriticalError(error: AppError): boolean {
    return (
      error.type === ErrorType.DATABASE_ERROR ||
      error.type === ErrorType.EXTERNAL_SERVICE_ERROR ||
      error.type === ErrorType.INTERNAL_ERROR ||
      error.type === ErrorType.CIRCUIT_BREAKER_ERROR
    );
  }

  private isWarningError(error: AppError): boolean {
    return (
      error.type === ErrorType.VALIDATION_ERROR ||
      error.type === ErrorType.NOT_FOUND_ERROR ||
      error.type === ErrorType.CONFLICT_ERROR
    );
  }

  private generateCorrelationId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
      case ErrorType.EXTERNAL_SERVICE_ERROR:
        return 503;
      case ErrorType.DATABASE_ERROR:
      case ErrorType.INTERNAL_ERROR:
      case ErrorType.UNKNOWN_ERROR:
      default:
        return 500;
    }
  }

  private isDevEnvironment(): boolean {
    return (
      process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev'
    );
  }
}
