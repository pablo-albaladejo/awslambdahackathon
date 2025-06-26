import { z } from 'zod';

// Base schemas for common patterns
export const TimestampSchema = z.string().datetime();
export const IdSchema = z.string().min(1);
export const EmailSchema = z.string().email();
export const UrlSchema = z.string().url();

// Environment validation schema
export const EnvironmentSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  AWS_REGION: z.string().min(1),
  AWS_ACCOUNT_ID: z.string().min(1),
});

// User schema
export const UserSchema = z.object({
  id: IdSchema,
  email: EmailSchema,
  username: z.string().min(1),
  groups: z.array(z.string()).default([]),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});

// Session schema
export const SessionSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  token: z.string().min(1),
  expiresAt: TimestampSchema,
  createdAt: TimestampSchema,
});

// Error schema
export const ErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.record(z.unknown()).optional(),
  timestamp: TimestampSchema,
});

// Performance metrics schema
export const PerformanceMetricSchema = z.object({
  name: z.string().min(1),
  value: z.number(),
  timestamp: TimestampSchema,
  metadata: z.record(z.unknown()).optional(),
});

// API response schema
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
  timestamp: TimestampSchema.optional(),
});

// Lambda response schema for API Gateway
export const LambdaResponseSchema = z.object({
  statusCode: z.number().int().min(100).max(599),
  headers: z.record(z.string()).optional(),
  body: z.string(),
  isBase64Encoded: z.boolean().optional(),
});

// Type exports
export type Environment = z.infer<typeof EnvironmentSchema>;
export type User = z.infer<typeof UserSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type Error = z.infer<typeof ErrorSchema>;
export type PerformanceMetric = z.infer<typeof PerformanceMetricSchema>;
export type ApiResponse<T = unknown> = z.infer<typeof ApiResponseSchema> & {
  data?: T;
};
export type LambdaResponse = z.infer<typeof LambdaResponseSchema>;
