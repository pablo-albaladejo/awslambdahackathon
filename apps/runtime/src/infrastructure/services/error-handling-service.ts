import {
  DynamoDBServiceException,
  InternalServerError,
  ProvisionedThroughputExceededException,
} from '@aws-sdk/client-dynamodb';
import { logger } from '@awslambdahackathon/utils/lambda';
import { container } from '@config/container';
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
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
}

export interface AppError {
  type: ErrorType;
  message: string;
  code: string;
  statusCode: number;
  details?: Record<string, unknown>;
  retryable: boolean;
  timestamp: string;
  correlationId?: string;
  stack?: string;
}

export interface ErrorContext {
  requestId?: string;
  connectionId?: string;
  userId?: string;
  action?: string;
  event?: APIGatewayProxyEvent;
  correlationId?: string;
  timestamp?: string;
  userAgent?: string;
  sourceIp?: string;
  stage?: string;
}

export interface DatabaseError {
  code?: string;
  name?: string;
  statusCode?: number;
  message?: string;
}

export class ErrorHandlingService {
  /**
   * Create a standardized error object with enhanced debugging information
   */
  createError(
    type: ErrorType,
    message: string,
    code: string,
    details?: Record<string, unknown>,
    correlationId?: string
  ): AppError {
    const errorMap: Record<
      ErrorType,
      { statusCode: number; retryable: boolean; defaultMessage: string }
    > = {
      [ErrorType.VALIDATION_ERROR]: {
        statusCode: 400,
        retryable: false,
        defaultMessage: 'Invalid request data provided',
      },
      [ErrorType.AUTHENTICATION_ERROR]: {
        statusCode: 401,
        retryable: false,
        defaultMessage: 'Authentication required or failed',
      },
      [ErrorType.AUTHORIZATION_ERROR]: {
        statusCode: 403,
        retryable: false,
        defaultMessage: 'Insufficient permissions for this operation',
      },
      [ErrorType.NOT_FOUND_ERROR]: {
        statusCode: 404,
        retryable: false,
        defaultMessage: 'Requested resource not found',
      },
      [ErrorType.RATE_LIMIT_ERROR]: {
        statusCode: 429,
        retryable: true,
        defaultMessage: 'Rate limit exceeded, please try again later',
      },
      [ErrorType.INTERNAL_ERROR]: {
        statusCode: 500,
        retryable: true,
        defaultMessage: 'An internal server error occurred',
      },
      [ErrorType.WEBSOCKET_ERROR]: {
        statusCode: 500,
        retryable: true,
        defaultMessage: 'WebSocket operation failed',
      },
      [ErrorType.DATABASE_ERROR]: {
        statusCode: 500,
        retryable: true,
        defaultMessage: 'Database operation failed',
      },
      [ErrorType.EXTERNAL_SERVICE_ERROR]: {
        statusCode: 502,
        retryable: true,
        defaultMessage: 'External service temporarily unavailable',
      },
      [ErrorType.TIMEOUT_ERROR]: {
        statusCode: 504,
        retryable: true,
        defaultMessage: 'Operation timed out',
      },
    };

    const { statusCode, retryable, defaultMessage } = errorMap[type];
    const finalMessage = message || defaultMessage;

    return {
      type,
      message: finalMessage,
      code,
      statusCode,
      details: {
        ...details,
        errorType: type,
        timestamp: new Date().toISOString(),
        ...(correlationId && { correlationId }),
      },
      retryable,
      timestamp: new Date().toISOString(),
      correlationId,
      stack: new Error().stack,
    };
  }

  /**
   * Handle and log errors consistently with enhanced context
   */
  handleError(error: Error | AppError, context: ErrorContext = {}): AppError {
    let appError: AppError;

    if (this.isAppError(error)) {
      appError = error;
    } else {
      // Convert generic errors to AppError with enhanced context
      const errorType = this.determineErrorType(error);
      appError = this.createError(
        errorType,
        this.enhanceErrorMessage(error.message, context),
        this.generateErrorCode(error, context),
        {
          originalError: {
            name: error.name,
            message: error.message,
            stack: error.stack,
          },
          context: this.sanitizeContext(context),
        },
        context.correlationId
      );
    }

    // Log error with enhanced context
    this.logError(appError, context);

    return appError;
  }

  /**
   * Create error response for API Gateway with enhanced debugging information
   */
  createErrorResponse(
    error: AppError,
    event?: APIGatewayProxyEvent
  ): APIGatewayProxyResult {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const requestId = event?.requestContext?.requestId || 'unknown';
    const correlationId = error.correlationId || requestId;

    const response: APIGatewayProxyResult = {
      statusCode: error.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': requestId,
        'X-Correlation-ID': correlationId,
        'X-Error-Type': error.type,
        'X-Error-Code': error.code,
        ...(isDevelopment && {
          'X-Debug-Mode': 'enabled',
        }),
      },
      body: JSON.stringify({
        success: false,
        error: {
          type: error.type,
          message: error.message,
          code: error.code,
          timestamp: error.timestamp,
          correlationId,
          ...(isDevelopment && {
            details: error.details,
            stack: error.stack,
            debug: {
              requestId,
              userAgent: event?.headers?.['User-Agent'],
              sourceIp: event?.requestContext?.identity?.sourceIp,
              stage: event?.requestContext?.stage,
            },
          }),
        },
      }),
    };

    return response;
  }

  /**
   * Handle WebSocket specific errors with enhanced messaging
   */
  async handleWebSocketError(
    error: AppError,
    connectionId: string,
    event: APIGatewayProxyEvent
  ): Promise<void> {
    try {
      const enhancedMessage = this.createWebSocketErrorMessage(
        error,
        connectionId
      );
      await container
        .getWebSocketMessageService()
        .sendErrorMessage(connectionId, event, enhancedMessage);
    } catch (sendError) {
      logger.error('Failed to send error message to WebSocket client', {
        connectionId,
        originalError: error,
        sendError:
          sendError instanceof Error ? sendError.message : String(sendError),
        requestId: event.requestContext?.requestId,
        correlationId: error.correlationId,
      });
    }
  }

  /**
   * Validate required fields and create detailed validation errors
   */
  validateRequiredFields(
    data: Record<string, unknown>,
    requiredFields: string[],
    context?: string
  ): AppError | null {
    const missingFields = requiredFields.filter(field => !data[field]);
    const emptyFields = requiredFields.filter(
      field =>
        data[field] !== undefined &&
        data[field] !== null &&
        String(data[field]).trim() === ''
    );

    if (missingFields.length > 0 || emptyFields.length > 0) {
      const issues = [];
      if (missingFields.length > 0) {
        issues.push(`Missing fields: ${missingFields.join(', ')}`);
      }
      if (emptyFields.length > 0) {
        issues.push(`Empty fields: ${emptyFields.join(', ')}`);
      }

      return this.createError(
        ErrorType.VALIDATION_ERROR,
        `Validation failed: ${issues.join('; ')}`,
        'VALIDATION_FAILED',
        {
          missingFields,
          emptyFields,
          context,
          providedFields: Object.keys(data),
          totalRequired: requiredFields.length,
          totalProvided: Object.keys(data).length,
        }
      );
    }

    return null;
  }

  /**
   * Handle database errors specifically with detailed error information
   */
  handleDatabaseError(
    error: unknown,
    operation: string,
    context?: Record<string, unknown>
  ): AppError {
    // Check if it's a DynamoDB error
    if (this.isDynamoDBError(error)) {
      const isRetryable = this.isDatabaseErrorRetryable(error);
      const errorDetails = this.extractDatabaseErrorDetails(error);

      return this.createError(
        ErrorType.DATABASE_ERROR,
        `Database operation '${operation}' failed: ${errorDetails.message}`,
        errorDetails.code,
        {
          operation,
          databaseError: errorDetails,
          context,
          retryable: isRetryable,
          suggestions: this.getDatabaseErrorSuggestions(errorDetails.code),
        }
      );
    }

    // Handle generic database errors
    return this.createError(
      ErrorType.DATABASE_ERROR,
      `Database operation '${operation}' failed`,
      'DATABASE_OPERATION_FAILED',
      {
        operation,
        originalError: error instanceof Error ? error.message : String(error),
        context,
      }
    );
  }

  /**
   * Handle external service errors with circuit breaker context
   */
  handleExternalServiceError(
    error: unknown,
    serviceName: string,
    operation: string,
    context?: Record<string, unknown>
  ): AppError {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isTimeout =
      errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT');
    const isNetworkError =
      errorMessage.includes('ENOTFOUND') ||
      errorMessage.includes('ECONNREFUSED');

    const errorType = isTimeout
      ? ErrorType.TIMEOUT_ERROR
      : isNetworkError
        ? ErrorType.EXTERNAL_SERVICE_ERROR
        : ErrorType.INTERNAL_ERROR;

    return this.createError(
      errorType,
      `External service '${serviceName}' operation '${operation}' failed: ${errorMessage}`,
      'EXTERNAL_SERVICE_FAILED',
      {
        serviceName,
        operation,
        originalError: errorMessage,
        context,
        retryable: isTimeout || isNetworkError,
        circuitBreaker: {
          service: serviceName,
          operation,
          timestamp: new Date().toISOString(),
        },
      }
    );
  }

  /**
   * Determine error type based on error characteristics
   */
  private determineErrorType(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    if (name.includes('validation') || message.includes('validation')) {
      return ErrorType.VALIDATION_ERROR;
    }
    if (
      name.includes('auth') ||
      message.includes('auth') ||
      message.includes('unauthorized')
    ) {
      return ErrorType.AUTHENTICATION_ERROR;
    }
    if (name.includes('timeout') || message.includes('timeout')) {
      return ErrorType.TIMEOUT_ERROR;
    }
    if (
      name.includes('network') ||
      message.includes('network') ||
      message.includes('connection')
    ) {
      return ErrorType.EXTERNAL_SERVICE_ERROR;
    }

    return ErrorType.INTERNAL_ERROR;
  }

  /**
   * Enhance error messages with context information
   */
  private enhanceErrorMessage(message: string, context: ErrorContext): string {
    let enhancedMessage = message;

    if (context.connectionId) {
      enhancedMessage += ` (Connection: ${context.connectionId})`;
    }
    if (context.action) {
      enhancedMessage += ` (Action: ${context.action})`;
    }
    if (context.userId) {
      enhancedMessage += ` (User: ${context.userId})`;
    }

    return enhancedMessage;
  }

  /**
   * Generate error codes based on error and context
   */
  private generateErrorCode(error: Error, context: ErrorContext): string {
    const baseCode = error.name.toUpperCase().replace(/\s+/g, '_');

    if (context.action) {
      return `${baseCode}_${context.action.toUpperCase()}`;
    }

    return baseCode;
  }

  /**
   * Create enhanced WebSocket error messages
   */
  private createWebSocketErrorMessage(
    error: AppError,
    connectionId: string
  ): string {
    const baseMessage = error.message;
    const debugInfo = `[${error.code}]`;
    const connectionInfo = `(Connection: ${connectionId})`;

    return `${baseMessage} ${debugInfo} ${connectionInfo}`;
  }

  /**
   * Extract detailed database error information
   */
  private extractDatabaseErrorDetails(error: DynamoDBServiceException): {
    code: string;
    message: string;
    statusCode?: number;
  } {
    return {
      code: error.name || 'DYNAMODB_ERROR',
      message: error.message || 'Unknown DynamoDB error',
      statusCode: error.$metadata?.httpStatusCode,
    };
  }

  /**
   * Get suggestions for database error resolution
   */
  private getDatabaseErrorSuggestions(errorCode: string): string[] {
    const suggestions: Record<string, string[]> = {
      ProvisionedThroughputExceededException: [
        'Consider increasing DynamoDB read/write capacity',
        'Implement exponential backoff retry logic',
        'Use DynamoDB on-demand capacity for variable workloads',
      ],
      ConditionalCheckFailedException: [
        'Check if the item exists before updating',
        'Verify the condition expression is correct',
        'Consider using optimistic locking',
      ],
      ResourceNotFoundException: [
        'Verify the table name is correct',
        'Check if the table exists in the specified region',
        'Ensure proper IAM permissions',
      ],
    };

    return (
      suggestions[errorCode] || ['Check AWS documentation for error details']
    );
  }

  /**
   * Sanitize context for logging (remove sensitive information)
   */
  private sanitizeContext(context: ErrorContext): Partial<ErrorContext> {
    const sanitized = { ...context };

    // Remove potentially sensitive information
    delete sanitized.event;

    return sanitized;
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
      logger.error('Client error occurred', logData);
    } else {
      logger.info('Application error occurred', logData);
    }
  }
}
