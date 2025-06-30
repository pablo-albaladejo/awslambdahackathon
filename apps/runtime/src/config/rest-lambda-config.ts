import { logger } from '@awslambdahackathon/utils/lambda';
import { z } from 'zod';

import {
  BaseLambdaConfig,
  BaseLambdaEnvironmentVarsSchema,
  createBaseLambdaConfig,
  validateBaseRequiredEnvironmentVariables,
} from './base-lambda-config';

// REST API-specific environment variables schema (minimal)
const RestLambdaEnvironmentVarsSchema = BaseLambdaEnvironmentVarsSchema.extend({
  // Optional database configuration (only if needed)
  DYNAMODB_ENDPOINT: z.string().url().optional(), // For local development

  // Optional authentication configuration (only if needed)
  COGNITO_USER_POOL_ID: z.string().min(1).optional(),
  COGNITO_CLIENT_ID: z.string().min(1).optional(),
  COGNITO_REGION: z.string().default('us-east-1'),

  // Optional rate limiting configuration
  RATE_LIMIT_ENABLED: z
    .string()
    .transform(val => val === 'true')
    .default('false'), // Disabled by default for simple REST APIs

  MAX_REQUESTS_PER_MINUTE: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('1000'), // Higher default for REST APIs

  // CORS configuration
  ALLOWED_ORIGINS: z.string().default('*'),
  ALLOWED_METHODS: z.string().default('GET,POST,PUT,DELETE,OPTIONS'),
  ALLOWED_HEADERS: z
    .string()
    .default(
      'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token'
    ),
});

// REST Lambda configuration interface (extends base only)
export interface RestLambdaConfig extends BaseLambdaConfig {
  database?: {
    region: string;
    endpoint?: string;
  };
  auth?: {
    userPoolId: string;
    userPoolClientId: string;
    region: string;
  };
  rateLimit: {
    enabled: boolean;
    maxRequestsPerMinute: number;
  };
  cors: {
    allowedOrigins: string[];
    allowedMethods: string[];
    allowedHeaders: string[];
  };
}

// Parse and validate REST environment variables
export const parseRestLambdaEnvironmentVars = (): z.infer<
  typeof RestLambdaEnvironmentVarsSchema
> => {
  try {
    return RestLambdaEnvironmentVarsSchema.parse(process.env);
  } catch (error) {
    logger.error(
      'REST Lambda environment variables validation failed:',
      error instanceof Error ? error : String(error)
    );
    throw new Error('Invalid REST Lambda environment configuration');
  }
};

// Create REST Lambda configuration
export const createRestLambdaConfig = (): RestLambdaConfig => {
  const baseConfig = createBaseLambdaConfig();
  const env = parseRestLambdaEnvironmentVars();

  const config: RestLambdaConfig = {
    ...baseConfig,
    rateLimit: {
      enabled: env.RATE_LIMIT_ENABLED,
      maxRequestsPerMinute: env.MAX_REQUESTS_PER_MINUTE,
    },
    cors: {
      allowedOrigins: env.ALLOWED_ORIGINS.split(',').map(origin =>
        origin.trim()
      ),
      allowedMethods: env.ALLOWED_METHODS.split(',').map(method =>
        method.trim()
      ),
      allowedHeaders: env.ALLOWED_HEADERS.split(',').map(header =>
        header.trim()
      ),
    },
  };

  // Add optional database config if endpoint is provided
  if (env.DYNAMODB_ENDPOINT) {
    config.database = {
      region: env.AWS_REGION,
      endpoint: env.DYNAMODB_ENDPOINT,
    };
  }

  // Add optional auth config if Cognito variables are provided
  if (env.COGNITO_USER_POOL_ID && env.COGNITO_CLIENT_ID) {
    config.auth = {
      userPoolId: env.COGNITO_USER_POOL_ID,
      userPoolClientId: env.COGNITO_CLIENT_ID,
      region: env.COGNITO_REGION,
    };
  }

  return config;
};

// Validate REST required environment variables (only base requirements)
export const validateRestRequiredEnvironmentVariables = (): void => {
  // Only validate base requirements - REST APIs are more flexible
  validateBaseRequiredEnvironmentVariables();

  // Log what optional features are available
  const hasDatabase = !!process.env.DYNAMODB_ENDPOINT;
  const hasAuth = !!(
    process.env.COGNITO_USER_POOL_ID && process.env.COGNITO_CLIENT_ID
  );

  logger.info('REST Lambda configuration:', {
    hasDatabase,
    hasAuth,
    rateLimitEnabled: process.env.RATE_LIMIT_ENABLED === 'true',
  });
};

// Export the validated configuration
export const REST_LAMBDA_CONFIG = createRestLambdaConfig();

// Export configuration getters for type safety
export const getRestDatabaseConfig = () => REST_LAMBDA_CONFIG.database;
export const getRestAuthConfig = () => REST_LAMBDA_CONFIG.auth;
export const getRestRateLimitConfig = () => REST_LAMBDA_CONFIG.rateLimit;
export const getRestCorsConfig = () => REST_LAMBDA_CONFIG.cors;
