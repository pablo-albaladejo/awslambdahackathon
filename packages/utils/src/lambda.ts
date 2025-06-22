import { Logger } from '@aws-lambda-powertools/logger';
import { Metrics } from '@aws-lambda-powertools/metrics';
import { Tracer } from '@aws-lambda-powertools/tracer';
import middy from '@middy/core';
import cors from '@middy/http-cors';
import httpErrorHandler from '@middy/http-error-handler';
import httpJsonBodyParser from '@middy/http-json-body-parser';
import validator from '@middy/validator';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import type { ZodSchema } from 'zod';
// Define LogLevel type locally
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

// Create centralized logger, tracer, and metrics instances
export const logger = new Logger({
  serviceName: 'awslambdahackathon-api',
  logLevel: (process.env.LOG_LEVEL as LogLevel) || 'INFO',
});

export const tracer = new Tracer({
  serviceName: 'awslambdahackathon-api',
});

export const metrics = new Metrics({
  namespace: 'awslambdahackathon',
  serviceName: 'awslambdahackathon-api',
});

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
        eventSchema: schema,
      })
    );
  }

  return middy(handler).use(middlewares);
};

// Common Zod schemas
import { z } from 'zod';

export const commonSchemas = {
  // Health check schema
  health: z.object({
    queryStringParameters: z.record(z.string()).optional(),
  }),

  // Generic API Gateway event schema
  apiGatewayEvent: z.object({
    httpMethod: z.string(),
    path: z.string(),
    queryStringParameters: z.record(z.string()).optional(),
    pathParameters: z.record(z.string()).optional(),
    headers: z.record(z.string()).optional(),
    body: z.any().optional(),
  }),
};
