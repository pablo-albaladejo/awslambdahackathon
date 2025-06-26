import {
  DynamoDBServiceException,
  InternalServerError,
  ProvisionedThroughputExceededException,
} from '@aws-sdk/client-dynamodb';
import { logger } from '@awslambdahackathon/utils/lambda';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  WEBSOCKET_ERROR = 'WEBSOCKET_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

export interface AppError {
  type: ErrorType;
  message: string;
  code: string;
  statusCode: number;
  details?: Record<string, unknown>;
  retryable: boolean;
}

export interface ErrorContext {
  requestId?: string;
  connectionId?: string;
  userId?: string;
  action?: string;
  event?: APIGatewayProxyEvent;
}

export interface DatabaseError {
  code?: string;
  name?: string;
  statusCode?: number;
  message?: string;
}

export class ErrorHandlingService {
  /**
   * Create a standardized error object
   */
  createError(
    type: ErrorType,
    message: string,
    code: string,
    details?: Record<string, unknown>
  ): AppError {
    const errorMap: Record<
      ErrorType,
      { statusCode: number; retryable: boolean }
    > = {
      [ErrorType.VALIDATION_ERROR]: { statusCode: 400, retryable: false },
      [ErrorType.AUTHENTICATION_ERROR]: { statusCode: 401, retryable: false },
      [ErrorType.AUTHORIZATION_ERROR]: { statusCode: 403, retryable: false },
      [ErrorType.NOT_FOUND_ERROR]: { statusCode: 404, retryable: false },
      [ErrorType.RATE_LIMIT_ERROR]: { statusCode: 429, retryable: true },
      [ErrorType.INTERNAL_ERROR]: { statusCode: 500, retryable: true },
      [ErrorType.WEBSOCKET_ERROR]: { statusCode: 500, retryable: true },
      [ErrorType.DATABASE_ERROR]: { statusCode: 500, retryable: true },
    };

    const { statusCode, retryable } = errorMap[type];

    return {
      type,
      message,
      code,
      statusCode,
      details,
      retryable,
    };
  }

  /**
   * Handle and log errors consistently
   */
  handleError(error: Error | AppError, context: ErrorContext = {}): AppError {
    let appError: AppError;

    if (this.isAppError(error)) {
      appError = error;
    } else {
      // Convert generic errors to AppError
      appError = this.createError(
        ErrorType.INTERNAL_ERROR,
        error.message || 'An unexpected error occurred',
        'INTERNAL_ERROR',
        { originalError: error.name }
      );
    }

    // Log error with context
    this.logError(appError, context);

    return appError;
  }

  /**
   * Create error response for API Gateway
   */
  createErrorResponse(
    error: AppError,
    event?: APIGatewayProxyEvent
  ): APIGatewayProxyResult {
    const response: APIGatewayProxyResult = {
      statusCode: error.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': event?.requestContext?.requestId || 'unknown',
      },
      body: JSON.stringify({
        success: false,
        error: {
          type: error.type,
          message: error.message,
          code: error.code,
          ...(process.env.NODE_ENV === 'development' && {
            details: error.details,
          }),
        },
      }),
    };

    return response;
  }

  /**
   * Handle WebSocket specific errors
   */
  async handleWebSocketError(
    error: AppError,
    connectionId: string,
    event: APIGatewayProxyEvent
  ): Promise<void> {
    const { websocketMessageService } = await import(
      './websocket-message-service'
    );

    try {
      await websocketMessageService.sendErrorMessage(
        connectionId,
        event,
        error.message
      );
    } catch (sendError) {
      logger.error('Failed to send error message to WebSocket client', {
        connectionId,
        originalError: error,
        sendError,
      });
    }
  }

  /**
   * Validate required fields and create validation errors
   */
  validateRequiredFields(
    data: Record<string, unknown>,
    requiredFields: string[],
    context?: string
  ): AppError | null {
    const missingFields = requiredFields.filter(field => !data[field]);

    if (missingFields.length > 0) {
      return this.createError(
        ErrorType.VALIDATION_ERROR,
        `Missing required fields: ${missingFields.join(', ')}`,
        'MISSING_REQUIRED_FIELDS',
        {
          missingFields,
          context,
          providedFields: Object.keys(data),
        }
      );
    }

    return null;
  }

  /**
   * Handle database errors specifically with proper error casting
   */
  handleDatabaseError(
    error: unknown,
    operation: string,
    context?: Record<string, unknown>
  ): AppError {
    // Check if it's a DynamoDB error
    if (this.isDynamoDBError(error)) {
      const isRetryable = this.isDatabaseErrorRetryable(error);

      return this.createError(
        ErrorType.DATABASE_ERROR,
        `Database operation failed: ${operation}`,
        'DATABASE_ERROR',
        {
          operation,
          errorCode: error.name,
          errorMessage: error.message,
          context,
          retryable: isRetryable,
        }
      );
    }

    // Handle non-DynamoDB errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    return this.createError(
      ErrorType.DATABASE_ERROR,
      `Database operation failed: ${operation}`,
      'DATABASE_ERROR',
      {
        operation,
        errorMessage,
        context,
        retryable: false,
      }
    );
  }

  /**
   * Check if error is a DynamoDB error
   */
  private isDynamoDBError(error: unknown): error is DynamoDBServiceException {
    return error instanceof DynamoDBServiceException;
  }

  /**
   * Check if database error is retryable
   */
  private isDatabaseErrorRetryable(error: DynamoDBServiceException): boolean {
    const retryableErrorNames = [
      'ProvisionedThroughputExceededException',
      'ThrottlingException',
      'ServiceUnavailable',
      'InternalServerError',
    ];

    return (
      error instanceof ProvisionedThroughputExceededException ||
      error instanceof InternalServerError ||
      retryableErrorNames.includes(error.name) ||
      error.$metadata?.httpStatusCode === 429 ||
      (error.$metadata?.httpStatusCode !== undefined &&
        error.$metadata.httpStatusCode >= 500)
    );
  }

  /**
   * Check if error is an AppError
   */
  private isAppError(error: unknown): error is AppError {
    return (
      error !== null &&
      typeof error === 'object' &&
      'type' in error &&
      'statusCode' in error &&
      'code' in error &&
      'message' in error
    );
  }

  /**
   * Log error with structured context
   */
  private logError(appError: AppError, context: ErrorContext): void {
    const logData: Record<string, unknown> = {
      errorType: appError.type,
      errorCode: appError.code,
      message: appError.message,
      statusCode: appError.statusCode,
      retryable: appError.retryable,
      details: appError.details,
      ...context,
    };

    if (appError.statusCode >= 500) {
      logger.error('Application error occurred', logData);
    } else if (appError.statusCode >= 400) {
      logger.warn('Client error occurred', logData);
    } else {
      logger.info('Application error occurred', logData);
    }
  }
}

// Singleton instance
export const errorHandlingService = new ErrorHandlingService();

// Convenience functions
export const createError =
  errorHandlingService.createError.bind(errorHandlingService);
export const handleError =
  errorHandlingService.handleError.bind(errorHandlingService);
export const createErrorResponse =
  errorHandlingService.createErrorResponse.bind(errorHandlingService);
