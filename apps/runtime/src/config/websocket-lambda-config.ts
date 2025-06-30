import { logger } from '@awslambdahackathon/utils/lambda';
import { z } from 'zod';

import {
  BaseLambdaConfig,
  BaseLambdaEnvironmentVarsSchema,
  createBaseLambdaConfig,
  validateBaseRequiredEnvironmentVariables,
} from './base-lambda-config';

// WebSocket-specific environment variables schema
const WebSocketLambdaEnvironmentVarsSchema =
  BaseLambdaEnvironmentVarsSchema.extend({
    // Database configuration
    WEBSOCKET_CONNECTIONS_TABLE: z.string().min(1),
    WEBSOCKET_SESSIONS_TABLE: z.string().min(1),
    WEBSOCKET_MESSAGES_TABLE: z.string().min(1),

    // WebSocket configuration
    WEBSOCKET_ENDPOINT: z.string().url(),
    WEBSOCKET_STAGE: z.string().default('$default'),
    WEBSOCKET_CONNECTION_TIMEOUT: z
      .string()
      .transform(val => parseInt(val, 10))
      .default('10000'),

    // Authentication configuration
    COGNITO_USER_POOL_ID: z.string().min(1),
    COGNITO_CLIENT_ID: z.string().min(1),
    COGNITO_REGION: z.string().default('us-east-1'),

    // Rate limiting configuration
    RATE_LIMIT_ENABLED: z
      .string()
      .transform(val => val === 'true')
      .default('true'),
    MAX_REQUESTS_PER_MINUTE: z
      .string()
      .transform(val => parseInt(val, 10))
      .default('100'),
    MAX_CONNECTIONS_PER_USER: z
      .string()
      .transform(val => parseInt(val, 10))
      .default('3'),

    // Additional logging configuration
    ENABLE_STRUCTURED_LOGGING: z
      .string()
      .transform(val => val === 'true')
      .default('true'),
    ENABLE_REQUEST_LOGGING: z
      .string()
      .transform(val => val === 'true')
      .default('true'),
  });

// WebSocket Lambda configuration interface (extends base)
export interface WebSocketLambdaConfig extends BaseLambdaConfig {
  database: {
    connectionsTable: string;
    sessionsTable: string;
    messagesTable: string;
    region: string;
  };
  websocket: {
    endpoint: string;
    stage: string;
    connectionTimeout: number;
  };
  auth: {
    userPoolId: string;
    userPoolClientId: string;
    region: string;
  };
  rateLimit: {
    enabled: boolean;
    maxRequestsPerMinute: number;
    maxConnectionsPerUser: number;
  };
  logging: BaseLambdaConfig['logging'] & {
    enableStructuredLogging: boolean;
    enableRequestLogging: boolean;
  };
}

// Parse and validate WebSocket environment variables
export const parseWebSocketLambdaEnvironmentVars = (): z.infer<
  typeof WebSocketLambdaEnvironmentVarsSchema
> => {
  try {
    return WebSocketLambdaEnvironmentVarsSchema.parse(process.env);
  } catch (error) {
    logger.error(
      'WebSocket Lambda environment variables validation failed:',
      error instanceof Error ? error : String(error)
    );
    throw new Error('Invalid WebSocket Lambda environment configuration');
  }
};

// Create WebSocket Lambda configuration
export const createWebSocketLambdaConfig = (): WebSocketLambdaConfig => {
  const baseConfig = createBaseLambdaConfig();
  const env = parseWebSocketLambdaEnvironmentVars();

  return {
    ...baseConfig,
    database: {
      connectionsTable: env.WEBSOCKET_CONNECTIONS_TABLE,
      sessionsTable: env.WEBSOCKET_SESSIONS_TABLE,
      messagesTable: env.WEBSOCKET_MESSAGES_TABLE,
      region: env.AWS_REGION,
    },
    websocket: {
      endpoint: env.WEBSOCKET_ENDPOINT,
      stage: env.WEBSOCKET_STAGE,
      connectionTimeout: env.WEBSOCKET_CONNECTION_TIMEOUT,
    },
    auth: {
      userPoolId: env.COGNITO_USER_POOL_ID,
      userPoolClientId: env.COGNITO_CLIENT_ID,
      region: env.COGNITO_REGION,
    },
    rateLimit: {
      enabled: env.RATE_LIMIT_ENABLED,
      maxRequestsPerMinute: env.MAX_REQUESTS_PER_MINUTE,
      maxConnectionsPerUser: env.MAX_CONNECTIONS_PER_USER,
    },
    logging: {
      ...baseConfig.logging,
      enableStructuredLogging: env.ENABLE_STRUCTURED_LOGGING,
      enableRequestLogging: env.ENABLE_REQUEST_LOGGING,
    },
  };
};

// Validate WebSocket required environment variables
export const validateWebSocketRequiredEnvironmentVariables = (): void => {
  // First validate base requirements
  validateBaseRequiredEnvironmentVariables();

  // Then validate WebSocket-specific requirements
  const webSocketRequiredEnvVars = [
    'WEBSOCKET_CONNECTIONS_TABLE',
    'WEBSOCKET_SESSIONS_TABLE',
    'WEBSOCKET_MESSAGES_TABLE',
    'WEBSOCKET_ENDPOINT',
    'COGNITO_USER_POOL_ID',
    'COGNITO_CLIENT_ID',
  ];

  const missingEnvVars = webSocketRequiredEnvVars.filter(
    envVar => !process.env[envVar] || process.env[envVar]!.trim() === ''
  );

  if (missingEnvVars.length > 0) {
    const errorMessage = `The following WebSocket environment variables are required but not defined: ${missingEnvVars.join(', ')}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }
};

// Export the validated configuration
export const WEBSOCKET_LAMBDA_CONFIG = createWebSocketLambdaConfig();

// Export configuration getters for type safety
export const getWebSocketDatabaseConfig = () =>
  WEBSOCKET_LAMBDA_CONFIG.database;
export const getWebSocketConfig = () => WEBSOCKET_LAMBDA_CONFIG.websocket;
export const getWebSocketAuthConfig = () => WEBSOCKET_LAMBDA_CONFIG.auth;
export const getWebSocketRateLimitConfig = () =>
  WEBSOCKET_LAMBDA_CONFIG.rateLimit;
