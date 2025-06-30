/**
 * Shared error types for the AWS Lambda Hackathon project
 * These types are used across all modules (runtime, web, cdk)
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'CIRCUIT_BREAKER_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'USER_AUTHENTICATION_FAILED'
  | 'USER_NOT_FOUND'
  | 'CONNECTION_NOT_FOUND'
  | 'MESSAGE_VALIDATION_FAILED'
  | 'SESSION_EXPIRED'
  | 'USER_AUTHORIZATION_FAILED'
  | 'CONNECTION_LIMIT_EXCEEDED'
  | 'MESSAGE_RATE_LIMIT_EXCEEDED'
  | 'INVALID_TOKEN'
  | 'SERVICE_UNAVAILABLE'
  | 'CIRCUIT_BREAKER_OPEN';

/**
 * Base domain error class - used across all modules
 */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly details?: Record<string, unknown>,
    public readonly correlationId?: string
  ) {
    super(message);
    this.name = 'DomainError';
    Object.setPrototypeOf(this, DomainError.prototype);
  }
}

/**
 * Error context interface for better error tracking
 */
export interface ErrorContext {
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  connectionId?: string;
  operation?: string;
  timestamp?: string;
  [key: string]: unknown;
}

/**
 * Standardized error response format for APIs
 */
export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    correlationId?: string;
    timestamp: string;
  };
}

/**
 * Result type for operations that can fail - Alternative to throwing errors
 */
export type Result<T, E = DomainError> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Type guard to check if a Result is successful
 */
export function isSuccess<T, E>(
  result: Result<T, E>
): result is { success: true; data: T } {
  return result.success === true;
}

/**
 * Type guard to check if a Result is an error
 */
export function isError<T, E>(
  result: Result<T, E>
): result is { success: false; error: E } {
  return result.success === false;
}

/**
 * Helper to create successful result
 */
export function success<T>(data: T): Result<T> {
  return { success: true, data };
}

/**
 * Helper to create error result
 */
export function error<T, E = DomainError>(error: E): Result<T, E> {
  return { success: false, error };
}
