import { randomUUID } from 'crypto';

import { Logger } from '@aws-lambda-powertools/logger';
import { Metrics } from '@aws-lambda-powertools/metrics';
import { Tracer } from '@aws-lambda-powertools/tracer';
import type { ApiResponse, LambdaResponse } from '@awslambdahackathon/types';
import middy from '@middy/core';
import cors from '@middy/http-cors';
import httpErrorHandler from '@middy/http-error-handler';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import validator from '@middy/validator';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { z, type ZodSchema } from 'zod';

// Define LogLevel type locally
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

// HTTP response utilities for Lambda functions
const defaultHeaders = {
  'Content-Type': 'application/json',
};

// UUID generation utility
export const generateUUID = (): string => {
  return randomUUID();
};

// Correlation ID generation utility
export const generateCorrelationId = (prefix: string = 'req'): string => {
  return `${prefix}-${Date.now()}-${randomUUID().substring(0, 8)}`;
};

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

// AppError interface for consistent error handling
export interface AppError {
  type: string;
  message: string;
  code: string;
  statusCode: number;
  details?: Record<string, unknown>;
  retryable: boolean;
}

// Updated createErrorResponse to accept AppError objects
export const createErrorResponse = (
  error: AppError | string,
  statusCode?: number
): LambdaResponse => {
  if (typeof error === 'string') {
    // Backward compatibility for string errors
    return {
      statusCode: statusCode || 500,
      headers: defaultHeaders,
      body: JSON.stringify({
        success: false,
        error,
      } as ApiResponse),
    };
  }

  // Handle AppError objects
  return {
    statusCode: error.statusCode,
    headers: {
      ...defaultHeaders,
      'X-Request-ID': 'unknown', // Will be overridden by handlers
    },
    body: JSON.stringify({
      success: false,
      error: error.message, // Use message as string for ApiResponse compatibility
      errorDetails: {
        type: error.type,
        code: error.code,
        ...(process.env.NODE_ENV === 'development' && {
          details: error.details,
        }),
      },
    }),
  };
};

// --- AWS Lambda Powertools: Logging, Metrics, Tracing ---
// Set these environment variables in your Lambda for Powertools:
// LOG_LEVEL=info
// POWERTOOLS_SERVICE_NAME=websocket-api
// POWERTOOLS_METRICS_NAMESPACE=AWSLambdaHackathon

export const logger = new Logger();
export const tracer = new Tracer();
export const metrics = new Metrics();

// Lambda Powertools utilities
export { Logger } from '@aws-lambda-powertools/logger';
export { Metrics } from '@aws-lambda-powertools/metrics';
export { Tracer } from '@aws-lambda-powertools/tracer';

// Middy utilities
export { default as middy } from '@middy/core';
export { default as cors } from '@middy/http-cors';
export { default as httpErrorHandler } from '@middy/http-error-handler';
export { default as httpJsonBodyParser } from '@middy/http-json-body-parser';
export { default as validator } from '@middy/validator';

// Custom middleware for automatic request/response logging
export const requestResponseLogger = () => {
  return {
    before: async (
      request: middy.Request<APIGatewayProxyEvent, APIGatewayProxyResult, Error>
    ): Promise<void> => {
      logger.info('Incoming request', {
        method: request.event.httpMethod,
        path: request.event.path,
        queryParams: request.event.queryStringParameters,
        headers: request.event.headers,
        body: request.event.body,
        requestId: request.event.requestContext?.requestId,
      });
    },
    after: async (
      request: middy.Request<APIGatewayProxyEvent, APIGatewayProxyResult, Error>
    ): Promise<void> => {
      logger.info('Outgoing response', {
        statusCode: (request.response as APIGatewayProxyResult).statusCode,
        body: (request.response as APIGatewayProxyResult).body,
        requestId: request.event.requestContext?.requestId,
      });
    },
    onError: async (
      request: middy.Request<APIGatewayProxyEvent, APIGatewayProxyResult, Error>
    ): Promise<void> => {
      logger.error('Request failed', {
        error: (request.error as Error)?.message,
        stack: (request.error as Error)?.stack,
        requestId: request.event.requestContext?.requestId,
      });
    },
  };
};

// Custom middleware for WebSocket-specific logging
export const websocketLogger = () => {
  return {
    before: async (
      request: middy.Request<APIGatewayProxyEvent, APIGatewayProxyResult, Error>
    ): Promise<void> => {
      const event = request.event;

      // Sanitize body to avoid logging sensitive data
      const sanitizedBody = event.body
        ? {
            length: event.body.length,
            hasContent: true,
            // Only log first 100 chars for debugging, but mask potential tokens
            preview:
              event.body.length > 100
                ? event.body.substring(0, 100) + '...'
                : event.body.replace(/"token"\s*:\s*"[^"]*"/g, '"token":"***"'),
          }
        : null;

      logger.info('WebSocket event received', {
        eventType: event.requestContext?.eventType,
        connectionId: event.requestContext?.connectionId,
        routeKey: event.requestContext?.routeKey,
        messageId: event.requestContext?.messageId,
        requestId: event.requestContext?.requestId,
        body: sanitizedBody,
      });
    },
    after: async (
      request: middy.Request<APIGatewayProxyEvent, APIGatewayProxyResult, Error>
    ): Promise<void> => {
      const event = request.event;
      logger.info('WebSocket response sent', {
        statusCode: (request.response as APIGatewayProxyResult).statusCode,
        connectionId: event.requestContext?.connectionId,
        requestId: event.requestContext?.requestId,
      });
    },
    onError: async (
      request: middy.Request<APIGatewayProxyEvent, APIGatewayProxyResult, Error>
    ): Promise<void> => {
      const event = request.event;
      logger.error('WebSocket event failed', {
        error: (request.error as Error)?.message,
        stack: (request.error as Error)?.stack,
        connectionId: event.requestContext?.connectionId,
        requestId: event.requestContext?.requestId,
        eventType: event.requestContext?.eventType,
      });
    },
  };
};

// Custom middleware for WebSocket message validation
export const websocketMessageValidator = () => {
  return {
    before: async (
      request: middy.Request<APIGatewayProxyEvent, APIGatewayProxyResult, Error>
    ): Promise<void> => {
      const event = request.event;

      // Only validate message events
      if (event.requestContext?.eventType === 'MESSAGE' && event.body) {
        try {
          const parsedBody = JSON.parse(event.body);
          commonSchemas.websocketMessageBody.parse(parsedBody);

          // Add parsed body to request for use in handler
          (request as any).parsedBody = parsedBody;
        } catch (error) {
          logger.error('WebSocket message validation failed', {
            error: error instanceof Error ? error.message : String(error),
            connectionId: event.requestContext?.connectionId,
            body: event.body,
          });
          throw error;
        }
      }
    },
  };
};

// Enhanced middleware factory function
export const createHandler = <
  TEvent = APIGatewayProxyEvent,
  TResult = APIGatewayProxyResult,
>(
  handler: (event: TEvent) => Promise<TResult>,
  schema?: ZodSchema
) => {
  const middlewares = [
    httpJsonBodyParser(),
    cors(),
    requestResponseLogger(), // Add automatic logging
    httpErrorHandler(),
  ];

  // Add validator middleware if schema is provided
  if (schema) {
    middlewares.push(
      validator({
        eventSchema: (event: TEvent) => schema.parse(event),
      })
    );
  }

  return middy(handler).use(middlewares);
};

// WebSocket-specific middleware factory function
export const createWebSocketHandler = <
  TEvent = APIGatewayProxyEvent,
  TResult = APIGatewayProxyResult,
>(
  handler: (event: TEvent, context?: any) => Promise<TResult>,
  schema?: ZodSchema
) => {
  const middlewares = [
    websocketLogger(), // Add WebSocket-specific logging
    websocketMessageValidator(), // Add WebSocket message validation
    httpErrorHandler(),
  ];

  // Add validator middleware if schema is provided
  if (schema) {
    middlewares.push(
      validator({
        eventSchema: (event: TEvent) => schema.parse(event),
      })
    );
  }

  return middy(handler).use(middlewares);
};

// Common Zod schemas
export const commonSchemas = {
  // Health check schema - validates the entire API Gateway event
  health: z.object({
    httpMethod: z.string(),
    path: z.string(),
    queryStringParameters: z.record(z.string()).optional().nullable(),
    pathParameters: z.record(z.string()).optional().nullable(),
    headers: z.record(z.string()).optional(),
    body: z.any().optional(),
    requestContext: z.any().optional(),
    multiValueQueryStringParameters: z
      .record(z.array(z.string()))
      .optional()
      .nullable(),
    multiValueHeaders: z.record(z.array(z.string())).optional(),
    isBase64Encoded: z.boolean().optional(),
  }),

  // Generic API Gateway event schema
  apiGatewayEvent: z.object({
    httpMethod: z.string(),
    path: z.string(),
    queryStringParameters: z.record(z.string()).optional().nullable(),
    pathParameters: z.record(z.string()).optional().nullable(),
    headers: z.record(z.string()).optional(),
    body: z.any().optional(),
    requestContext: z.any().optional(),
    multiValueQueryStringParameters: z
      .record(z.array(z.string()))
      .optional()
      .nullable(),
    multiValueHeaders: z.record(z.array(z.string())).optional(),
    isBase64Encoded: z.boolean().optional(),
  }),

  // WebSocket connection event schema
  websocketConnection: z.object({
    httpMethod: z.string(),
    path: z.string(),
    headers: z.record(z.string()).optional(),
    requestContext: z.object({
      requestId: z.string(),
      connectionId: z.string(),
      eventType: z.enum(['CONNECT', 'DISCONNECT']),
      routeKey: z.string().optional(),
      messageId: z.string().optional(),
      apiId: z.string(),
      stage: z.string(),
    }),
    multiValueHeaders: z.record(z.array(z.string())).optional(),
    isBase64Encoded: z.boolean().optional(),
  }),

  // WebSocket message event schema
  websocketMessage: z.object({
    httpMethod: z.string(),
    path: z.string(),
    headers: z.record(z.string()).optional(),
    body: z.string().optional(),
    requestContext: z.object({
      requestId: z.string(),
      connectionId: z.string(),
      eventType: z.enum(['MESSAGE']),
      routeKey: z.string(),
      messageId: z.string(),
      apiId: z.string(),
      stage: z.string(),
    }),
    multiValueHeaders: z.record(z.array(z.string())).optional(),
    isBase64Encoded: z.boolean().optional(),
  }),

  // WebSocket message body schema
  websocketMessageBody: z.object({
    type: z.enum(['auth', 'message', 'ping']),
    data: z.object({
      action: z.string(),
      message: z.string().optional(),
      sessionId: z.string().optional(),
      token: z.string().optional(),
    }),
  }),
};
