import { randomUUID } from 'crypto';

import { Logger } from '@aws-lambda-powertools/logger';
import { Metrics } from '@aws-lambda-powertools/metrics';
import { Tracer } from '@aws-lambda-powertools/tracer';
import type {
  ApiResponse,
  DomainError,
  ErrorResponse,
  LambdaResponse,
  Logger as LoggerInterface,
} from '@awslambdahackathon/types';
import middy from '@middy/core';
import cors from '@middy/http-cors';
import httpErrorHandler from '@middy/http-error-handler';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import validator from '@middy/validator';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { type ZodSchema } from 'zod';

// HTTP response utilities for Lambda functions
const defaultHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
};

// UUID generation utility
export const generateUUID = (): string => {
  return randomUUID();
};

// Correlation ID generation utility
export const generateCorrelationId = (prefix: string = 'req'): string => {
  return `${prefix}-${Date.now()}-${randomUUID().substring(0, 8)}`;
};

// Simple response creators using types from packages/types
export const createSuccessResponse = <T>(
  data: T,
  statusCode: number = 200
): LambdaResponse => ({
  statusCode,
  headers: defaultHeaders,
  body: JSON.stringify({
    success: true,
    data,
  } as ApiResponse<T>),
});

export const createErrorResponse = (
  error: DomainError | string,
  statusCode?: number
): LambdaResponse => {
  if (typeof error === 'string') {
    return {
      statusCode: statusCode || 500,
      headers: defaultHeaders,
      body: JSON.stringify({
        success: false,
        error,
      } as ApiResponse),
    };
  }

  return {
    statusCode: statusCode || 500,
    headers: defaultHeaders,
    body: JSON.stringify({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        correlationId: error.correlationId,
        timestamp: new Date().toISOString(),
      },
    } as ErrorResponse),
  };
};

// --- AWS Lambda Powertools instances ---
export const logger = new Logger();
export const tracer = new Tracer();
export const metrics = new Metrics();

/**
 * Logger adapter that implements the Logger interface from types
 * but uses AWS Lambda Powertools logger under the hood
 */
export class PowertoolsLoggerAdapter implements LoggerInterface {
  constructor(private readonly powertoolsLogger: Logger) {}

  info(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      this.powertoolsLogger.info(message, meta);
    } else {
      this.powertoolsLogger.info(message);
    }
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      this.powertoolsLogger.warn(message, meta);
    } else {
      this.powertoolsLogger.warn(message);
    }
  }

  error(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      this.powertoolsLogger.error(message, meta);
    } else {
      this.powertoolsLogger.error(message);
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      this.powertoolsLogger.debug(message, meta);
    } else {
      this.powertoolsLogger.debug(message);
    }
  }
}

// Create the adapter instance
export const loggerAdapter = new PowertoolsLoggerAdapter(logger);

/**
 * Unified Metrics and Tracing Service using AWS Lambda Powertools
 * Simplifies metrics collection and distributed tracing
 */
export class PowertoolsMetricsService {
  constructor(
    private readonly metrics: Metrics,
    private readonly tracer: Tracer
  ) {}

  // Core metrics methods
  addCountMetric(name: string, value: number = 1): void {
    this.metrics.addMetric(name, 'Count', value);
  }

  addDurationMetric(name: string, durationMs: number): void {
    this.metrics.addMetric(name, 'Milliseconds', durationMs);
  }

  addMemoryMetric(name: string, bytes: number): void {
    this.metrics.addMetric(name, 'Bytes', bytes);
  }

  addMetadata(key: string, value: string): void {
    this.metrics.addMetadata(key, value);
  }

  publishStoredMetrics(): void {
    this.metrics.publishStoredMetrics();
  }

  // Tracing methods
  putAnnotation(key: string, value: string | number): void {
    this.tracer.putAnnotation(key, value);
  }

  putMetadata(key: string, value: unknown, namespace?: string): void {
    this.tracer.putMetadata(key, value, namespace);
  }

  // High-level business metrics
  recordWebSocketEvent(
    event: 'connect' | 'disconnect' | 'message' | 'ping',
    success: boolean,
    duration?: number,
    errorType?: string,
    connectionId?: string
  ): void {
    this.addCountMetric(`websocket_${event}`, 1);
    this.addMetadata('success', success.toString());
    this.addMetadata('event_type', event);

    if (connectionId) {
      this.addMetadata('connection_id', connectionId);
    }

    if (duration !== undefined) {
      this.addDurationMetric(`websocket_${event}_duration`, duration);
    }

    if (!success && errorType) {
      this.addCountMetric(`websocket_${event}_error`, 1);
      this.addMetadata('error_type', errorType);
    }

    this.putAnnotation('websocket_event', event);
    this.putAnnotation('success', success.toString());
  }

  recordDatabaseOperation(
    operation: string,
    tableName: string,
    success: boolean,
    duration: number,
    errorType?: string
  ): void {
    this.addCountMetric(`database_${operation}`, 1);
    this.addDurationMetric(`database_${operation}_duration`, duration);
    this.addMetadata('table_name', tableName);
    this.addMetadata('success', success.toString());

    if (!success && errorType) {
      this.addCountMetric(`database_${operation}_error`, 1);
      this.addMetadata('error_type', errorType);
    }

    this.putAnnotation('db_operation', operation);
    this.putAnnotation('db_table', tableName);
    this.putAnnotation('success', success.toString());
  }

  recordAuthenticationEvent(
    success: boolean,
    duration: number,
    errorType?: string,
    userId?: string
  ): void {
    this.addCountMetric('authentication', 1);
    this.addDurationMetric('authentication_duration', duration);
    this.addMetadata('success', success.toString());

    if (userId) {
      this.addMetadata('user_id', userId);
    }

    if (!success && errorType) {
      this.addCountMetric('authentication_error', 1);
      this.addMetadata('error_type', errorType);
    }

    this.putAnnotation('auth_success', success.toString());
    if (userId) {
      this.putAnnotation('user_id', userId);
    }
  }

  recordError(
    errorType: string,
    operation: string,
    errorMessage?: string,
    additionalMetadata?: Record<string, string>
  ): void {
    this.addCountMetric('error_count', 1);
    this.addMetadata('error_type', errorType);
    this.addMetadata('operation', operation);

    if (errorMessage) {
      this.addMetadata('error_message', errorMessage);
    }

    if (additionalMetadata) {
      Object.entries(additionalMetadata).forEach(([key, val]) => {
        this.addMetadata(key, val);
      });
    }

    this.putAnnotation('error', 'true');
    this.putAnnotation('error_type', errorType);
    this.putAnnotation('operation', operation);
  }

  // Performance monitoring with automatic tracing
  async withPerformanceMonitoring<T>(
    operationName: string,
    operation: () => Promise<T>,
    metadata?: Record<string, string>
  ): Promise<T> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;

    const subsegment = this.tracer
      .getSegment()
      ?.addNewSubsegment(operationName);

    try {
      if (metadata) {
        Object.entries(metadata).forEach(([key, value]) => {
          this.addMetadata(key, value);
          subsegment?.addAnnotation(key, value);
        });
      }

      const result = await operation();

      const duration = Date.now() - startTime;
      const memoryUsed = process.memoryUsage().heapUsed - startMemory;

      this.addDurationMetric(`${operationName}_duration`, duration);
      this.addMemoryMetric(`${operationName}_memory`, memoryUsed);
      this.addCountMetric(`${operationName}_success`, 1);

      this.putAnnotation('operation', operationName);
      this.putAnnotation('duration_ms', duration);
      this.putAnnotation('success', 'true');

      subsegment?.close();

      return result;
    } catch (err) {
      const duration = Date.now() - startTime;
      const memoryUsed = process.memoryUsage().heapUsed - startMemory;

      this.addDurationMetric(`${operationName}_duration`, duration);
      this.addMemoryMetric(`${operationName}_memory`, memoryUsed);
      this.addCountMetric(`${operationName}_error`, 1);

      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorType = err instanceof Error ? err.constructor.name : 'Unknown';

      this.recordError(errorType, operationName, errorMessage);

      subsegment?.addError(err instanceof Error ? err : new Error(String(err)));
      subsegment?.close(err instanceof Error ? err : new Error(String(err)));

      throw err;
    }
  }
}

// Create the unified service instance
export const powertoolsMetricsService = new PowertoolsMetricsService(
  metrics,
  tracer
);

// Convenience function for tracing Lambda handlers
export const withTracing = <T extends unknown[], R>(
  name: string,
  fn: (...args: T) => Promise<R>
) => {
  return async (...args: T): Promise<R> => {
    return powertoolsMetricsService.withPerformanceMonitoring(name, () =>
      fn(...args)
    );
  };
};

// Enhanced handler factory with automatic tracing and error handling
export const createHandler = <
  TEvent = APIGatewayProxyEvent,
  TResult = APIGatewayProxyResult,
>(
  handler: (event: TEvent) => Promise<TResult>,
  schema?: ZodSchema
) => {
  const middlewares = [httpJsonBodyParser(), cors(), httpErrorHandler()];

  if (schema) {
    middlewares.push(
      validator({
        eventSchema: (event: TEvent) => schema.parse(event),
      })
    );
  }

  return middy(handler).use(middlewares);
};

// WebSocket-specific handler factory
export const createWebSocketHandler = <
  TEvent = APIGatewayProxyEvent,
  TResult = APIGatewayProxyResult,
>(
  handler: (event: TEvent, context?: unknown) => Promise<TResult>,
  schema?: ZodSchema
) => {
  const middlewares = [httpErrorHandler()];

  if (schema) {
    middlewares.push(
      validator({
        eventSchema: (event: TEvent) => schema.parse(event),
      })
    );
  }

  return middy(handler).use(middlewares);
};
