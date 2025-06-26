import {
  LambdaConfigSchema,
  type LambdaConfig,
} from '@awslambdahackathon/types';
import { logger } from '@awslambdahackathon/utils/lambda';
import { z } from 'zod';

// Environment variables schema for Lambda
const LambdaEnvironmentVarsSchema = z.object({
  // Database configuration
  DYNAMODB_TABLE_NAME: z.string().min(1),
  AWS_REGION: z.string().default('us-east-1'),
  DYNAMODB_ENDPOINT: z.string().url().optional(), // For local development

  // WebSocket configuration
  WEBSOCKET_ENDPOINT: z.string().url(),
  WEBSOCKET_STAGE: z.string().default('$default'),
  WEBSOCKET_CONNECTION_TIMEOUT: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('10000'),

  // Authentication configuration
  USER_POOL_ID: z.string().min(1),
  USER_POOL_CLIENT_ID: z.string().min(1),
  COGNITO_REGION: z.string().default('us-east-1'),

  // Logging configuration
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  ENABLE_STRUCTURED_LOGGING: z
    .string()
    .transform(val => val === 'true')
    .default('true'),
  ENABLE_REQUEST_LOGGING: z
    .string()
    .transform(val => val === 'true')
    .default('true'),

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

  // Environment
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  AWS_LAMBDA_FUNCTION_NAME: z.string().optional(),
  AWS_LAMBDA_FUNCTION_VERSION: z.string().optional(),
  AWS_LAMBDA_LOG_GROUP_NAME: z.string().optional(),
  AWS_LAMBDA_LOG_STREAM_NAME: z.string().optional(),
});

// Parse and validate environment variables
const parseLambdaEnvironmentVars = (): z.infer<
  typeof LambdaEnvironmentVarsSchema
> => {
  try {
    return LambdaEnvironmentVarsSchema.parse(process.env);
  } catch (error) {
    logger.error(
      'Lambda environment variables validation failed:',
      error instanceof Error ? error : String(error)
    );
    throw new Error('Invalid Lambda environment configuration');
  }
};

// Create Lambda configuration
const createLambdaConfig = (): LambdaConfig => {
  const env = parseLambdaEnvironmentVars();

  const config: LambdaConfig = {
    database: {
      tableName: env.DYNAMODB_TABLE_NAME,
      region: env.AWS_REGION,
      endpoint: env.DYNAMODB_ENDPOINT,
    },

    websocket: {
      endpoint: env.WEBSOCKET_ENDPOINT,
      stage: env.WEBSOCKET_STAGE,
      connectionTimeout: env.WEBSOCKET_CONNECTION_TIMEOUT,
    },

    auth: {
      userPoolId: env.USER_POOL_ID,
      userPoolClientId: env.USER_POOL_CLIENT_ID,
      region: env.COGNITO_REGION,
    },

    logging: {
      level: env.LOG_LEVEL,
      enableStructuredLogging: env.ENABLE_STRUCTURED_LOGGING,
      enableRequestLogging: env.ENABLE_REQUEST_LOGGING,
    },

    rateLimit: {
      enabled: env.RATE_LIMIT_ENABLED,
      maxRequestsPerMinute: env.MAX_REQUESTS_PER_MINUTE,
      maxConnectionsPerUser: env.MAX_CONNECTIONS_PER_USER,
    },
  };

  // Validate the final configuration
  return LambdaConfigSchema.parse(config);
};

// Export the validated configuration
export const LAMBDA_CONFIG = createLambdaConfig();

// Export configuration getters for type safety
export const getDatabaseConfig = () => LAMBDA_CONFIG.database;
export const getWebSocketConfig = () => LAMBDA_CONFIG.websocket;
export const getAuthConfig = () => LAMBDA_CONFIG.auth;
export const getLoggingConfig = () => LAMBDA_CONFIG.logging;
export const getRateLimitConfig = () => LAMBDA_CONFIG.rateLimit;

// Export environment helpers
export const isDevelopment = () => process.env.NODE_ENV === 'development';
export const isProduction = () => process.env.NODE_ENV === 'production';
export const isTest = () => process.env.NODE_ENV === 'test';
export const isLocalDevelopment = () => !!process.env.DYNAMODB_ENDPOINT;

// Export Lambda context helpers
export const getLambdaContext = () => ({
  functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
  functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION,
  logGroupName: process.env.AWS_LAMBDA_LOG_GROUP_NAME,
  logStreamName: process.env.AWS_LAMBDA_LOG_STREAM_NAME,
});

// Export configuration validation function
export const validateLambdaConfig = (): boolean => {
  try {
    LambdaConfigSchema.parse(LAMBDA_CONFIG);
    return true;
  } catch (error) {
    logger.error(
      'Lambda configuration validation failed:',
      error instanceof Error ? error : String(error)
    );
    return false;
  }
};

// Export configuration type
export type LambdaAppConfig = LambdaConfig;
