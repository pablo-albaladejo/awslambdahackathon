import {
  DEFAULT_FRONTEND_CONFIG,
  FrontendConfigSchema,
  type FrontendConfig,
} from '@awslambdahackathon/types';
import { logger } from '@awslambdahackathon/utils/frontend';
import { z } from 'zod';

// Environment variables schema
const EnvironmentVarsSchema = z.object({
  // WebSocket configuration
  VITE_WEBSOCKET_URL: z.string().url().optional(),

  // RUM configuration
  VITE_AWS_RUM_APPLICATION_ID: z.string().optional(),
  VITE_AWS_RUM_GUEST_ROLE_ARN: z.string().optional(),
  VITE_AWS_RUM_IDENTITY_POOL_ID: z.string().optional(),
  VITE_APP_VERSION: z.string().default('1.0.0'),
  VITE_AWS_REGION: z.string().default('us-east-1'),

  // Authentication configuration
  VITE_USER_POOL_ID: z.string().min(1),
  VITE_USER_POOL_CLIENT_ID: z.string().min(1),
  VITE_IDENTITY_POOL_ID: z.string().optional(),

  // API configuration
  VITE_API_BASE_URL: z.string().url().optional(),
  VITE_API_TIMEOUT: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('10000'),
  VITE_API_RETRY_ATTEMPTS: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('3'),

  // Performance configuration
  VITE_SLOW_RENDER_THRESHOLD: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('16'),
  VITE_MEMORY_WARNING_THRESHOLD: z
    .string()
    .transform(val => parseFloat(val))
    .default('0.8'),
  VITE_LONG_TASK_THRESHOLD: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('50'),
  VITE_LAYOUT_SHIFT_THRESHOLD: z
    .string()
    .transform(val => parseFloat(val))
    .default('0.1'),

  // WebSocket reconnection configuration
  VITE_WS_RECONNECT_ATTEMPTS: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('5'),
  VITE_WS_RECONNECT_DELAY: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('1000'),
  VITE_WS_MAX_RECONNECT_DELAY: z
    .string()
    .transform(val => parseInt(val, 10))
    .default('30000'),

  // Environment
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  VITE_DEBUG: z
    .string()
    .transform(val => val === 'true')
    .default('false'),
});

// Parse and validate environment variables
const parseEnvironmentVars = (): z.infer<typeof EnvironmentVarsSchema> => {
  try {
    return EnvironmentVarsSchema.parse(process.env);
  } catch (error) {
    logger.error('Environment variables validation failed:', error);
    throw new Error('Invalid environment configuration');
  }
};

// Create application configuration
const createAppConfig = (): FrontendConfig => {
  const env = parseEnvironmentVars();

  const config: FrontendConfig = {
    websocket: {
      url: env.VITE_WEBSOCKET_URL || DEFAULT_FRONTEND_CONFIG.websocket.url,
      reconnectAttempts: env.VITE_WS_RECONNECT_ATTEMPTS,
      reconnectDelay: env.VITE_WS_RECONNECT_DELAY,
      maxReconnectDelay: env.VITE_WS_MAX_RECONNECT_DELAY,
    },

    rum: {
      enabled: env.NODE_ENV === 'production',
      applicationId: env.VITE_AWS_RUM_APPLICATION_ID,
      applicationVersion: env.VITE_APP_VERSION,
      applicationRegion: env.VITE_AWS_REGION,
      guestRoleArn: env.VITE_AWS_RUM_GUEST_ROLE_ARN,
      identityPoolId: env.VITE_AWS_RUM_IDENTITY_POOL_ID,
    },

    performance: {
      slowRenderThreshold: env.VITE_SLOW_RENDER_THRESHOLD,
      memoryWarningThreshold: env.VITE_MEMORY_WARNING_THRESHOLD,
      longTaskThreshold: env.VITE_LONG_TASK_THRESHOLD,
      layoutShiftThreshold: env.VITE_LAYOUT_SHIFT_THRESHOLD,
    },

    auth: {
      userPoolId: env.VITE_USER_POOL_ID,
      userPoolClientId: env.VITE_USER_POOL_CLIENT_ID,
      identityPoolId: env.VITE_IDENTITY_POOL_ID,
      region: env.VITE_AWS_REGION,
    },

    api: {
      baseUrl: env.VITE_API_BASE_URL,
      timeout: env.VITE_API_TIMEOUT,
      retryAttempts: env.VITE_API_RETRY_ATTEMPTS,
    },
  };

  // Validate the final configuration
  return FrontendConfigSchema.parse(config);
};

// Export the validated configuration
export const APP_CONFIG = createAppConfig();

// Export configuration getters for type safety
export const getWebSocketConfig = () => APP_CONFIG.websocket;
export const getRumConfig = () => APP_CONFIG.rum;
export const getPerformanceConfig = () => APP_CONFIG.performance;
export const getAuthConfig = () => APP_CONFIG.auth;
export const getApiConfig = () => APP_CONFIG.api;

// Export environment helpers
export const isDevelopment = () => process.env.NODE_ENV === 'development';
export const isProduction = () => process.env.NODE_ENV === 'production';
export const isTest = () => process.env.NODE_ENV === 'test';
export const isDebugEnabled = () => process.env.VITE_DEBUG === 'true';

// Export configuration validation function
export const validateConfig = (): boolean => {
  try {
    FrontendConfigSchema.parse(APP_CONFIG);
    return true;
  } catch (error) {
    logger.error('Configuration validation failed:', error);
    return false;
  }
};

// Export configuration type
export type AppConfig = FrontendConfig;
