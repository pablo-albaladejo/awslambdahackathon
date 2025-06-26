import { z } from 'zod';

import { EnvironmentSchema } from './schemas';

// Frontend configuration schema
export const FrontendConfigSchema = z.object({
  // WebSocket configuration
  websocket: z.object({
    url: z.string().url(),
    reconnectAttempts: z.number().int().min(1).max(10).default(5),
    reconnectDelay: z.number().int().min(100).max(30000).default(1000),
    maxReconnectDelay: z.number().int().min(1000).max(60000).default(30000),
  }),

  // RUM (Real User Monitoring) configuration
  rum: z.object({
    enabled: z.boolean().default(false),
    applicationId: z.string().optional(),
    applicationVersion: z.string().default('1.0.0'),
    applicationRegion: z.string().default('us-east-1'),
    guestRoleArn: z.string().optional(),
    identityPoolId: z.string().optional(),
  }),

  // Performance monitoring configuration
  performance: z.object({
    slowRenderThreshold: z.number().int().min(1).max(100).default(16), // 60fps
    memoryWarningThreshold: z.number().min(0.1).max(1.0).default(0.8), // 80% of limit
    longTaskThreshold: z.number().int().min(10).max(1000).default(50), // 50ms
    layoutShiftThreshold: z.number().min(0.01).max(1.0).default(0.1),
  }),

  // Authentication configuration
  auth: z.object({
    userPoolId: z.string().min(1),
    userPoolClientId: z.string().min(1),
    identityPoolId: z.string().optional(),
    region: z.string().default('us-east-1'),
  }),

  // API configuration
  api: z.object({
    baseUrl: z.string().url().optional(),
    timeout: z.number().int().min(1000).max(30000).default(10000),
    retryAttempts: z.number().int().min(0).max(5).default(3),
  }),
});

// Lambda configuration schema
export const LambdaConfigSchema = z.object({
  // Database configuration
  database: z.object({
    tableName: z.string().min(1),
    region: z.string().default('us-east-1'),
    endpoint: z.string().url().optional(), // For local development
  }),

  // WebSocket configuration
  websocket: z.object({
    endpoint: z.string().url(),
    stage: z.string().default('$default'),
    connectionTimeout: z.number().int().min(1000).max(30000).default(10000),
  }),

  // Authentication configuration
  auth: z.object({
    userPoolId: z.string().min(1),
    userPoolClientId: z.string().min(1),
    region: z.string().default('us-east-1'),
  }),

  // Logging configuration
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    enableStructuredLogging: z.boolean().default(true),
    enableRequestLogging: z.boolean().default(true),
  }),

  // Rate limiting configuration
  rateLimit: z.object({
    enabled: z.boolean().default(true),
    maxRequestsPerMinute: z.number().int().min(1).max(1000).default(100),
    maxConnectionsPerUser: z.number().int().min(1).max(10).default(3),
  }),
});

// Shared configuration schema
export const SharedConfigSchema = z.object({
  environment: EnvironmentSchema,
  version: z.string().default('1.0.0'),
  debug: z.boolean().default(false),
});

// Type exports
export type FrontendConfig = z.infer<typeof FrontendConfigSchema>;
export type LambdaConfig = z.infer<typeof LambdaConfigSchema>;
export type SharedConfig = z.infer<typeof SharedConfigSchema>;

// Default configurations
export const DEFAULT_FRONTEND_CONFIG: FrontendConfig = {
  websocket: {
    url: 'wss://localhost:3001',
    reconnectAttempts: 5,
    reconnectDelay: 1000,
    maxReconnectDelay: 30000,
  },
  rum: {
    enabled: false,
    applicationVersion: '1.0.0',
    applicationRegion: 'us-east-1',
  },
  performance: {
    slowRenderThreshold: 16,
    memoryWarningThreshold: 0.8,
    longTaskThreshold: 50,
    layoutShiftThreshold: 0.1,
  },
  auth: {
    userPoolId: '',
    userPoolClientId: '',
    region: 'us-east-1',
  },
  api: {
    timeout: 10000,
    retryAttempts: 3,
  },
};

export const DEFAULT_LAMBDA_CONFIG: LambdaConfig = {
  database: {
    tableName: '',
    region: 'us-east-1',
  },
  websocket: {
    endpoint: '',
    stage: '$default',
    connectionTimeout: 10000,
  },
  auth: {
    userPoolId: '',
    userPoolClientId: '',
    region: 'us-east-1',
  },
  logging: {
    level: 'info',
    enableStructuredLogging: true,
    enableRequestLogging: true,
  },
  rateLimit: {
    enabled: true,
    maxRequestsPerMinute: 100,
    maxConnectionsPerUser: 3,
  },
};
