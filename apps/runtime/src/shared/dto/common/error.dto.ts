/**
 * Common error types used across the application
 */
export type ErrorType =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND_ERROR'
  | 'CONFLICT_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'INTERNAL_ERROR'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Common error DTO structure
 */
export interface ErrorDto {
  /** Error type */
  type: ErrorType;

  /** Error code for programmatic handling */
  code: string;

  /** Human-readable error message */
  message: string;

  /** Error severity */
  severity: ErrorSeverity;

  /** Detailed error information */
  details?: Record<string, unknown>;

  /** Field-specific errors (for validation errors) */
  fieldErrors?: Record<string, string[]>;

  /** Error timestamp */
  timestamp: string;

  /** Correlation ID for tracing */
  correlationId?: string;

  /** Stack trace (only in development) */
  stack?: string;

  /** Suggested resolution steps */
  resolution?: string[];

  /** Whether the error is retryable */
  retryable: boolean;

  /** Retry delay in milliseconds (if retryable) */
  retryAfter?: number;
}

/**
 * Validation error DTO
 */
export interface ValidationErrorDto extends ErrorDto {
  type: 'VALIDATION_ERROR';

  /** Failed validation rules */
  failedRules: string[];

  /** Input that caused the validation error */
  invalidInput?: Record<string, unknown>;
}

/**
 * Authentication error DTO
 */
export interface AuthenticationErrorDto extends ErrorDto {
  type: 'AUTHENTICATION_ERROR';

  /** Authentication method that failed */
  authMethod?: string;

  /** Whether the credentials are expired */
  expired?: boolean;

  /** Whether the user should be redirected to login */
  requiresLogin?: boolean;
}

/**
 * Authorization error DTO
 */
export interface AuthorizationErrorDto extends ErrorDto {
  type: 'AUTHORIZATION_ERROR';

  /** Required permissions */
  requiredPermissions?: string[];

  /** User's current permissions */
  userPermissions?: string[];

  /** Resource that was being accessed */
  resource?: string;

  /** Action that was being performed */
  action?: string;
}

/**
 * Rate limit error DTO
 */
export interface RateLimitErrorDto extends ErrorDto {
  type: 'RATE_LIMIT_ERROR';

  /** Current rate limit */
  limit: number;

  /** Time window for the rate limit */
  window: number;

  /** Number of requests made */
  requestCount: number;

  /** Time until rate limit resets */
  resetTime: string;
}

/**
 * Union type for all specific error DTOs
 */
export type SpecificErrorDto =
  | ValidationErrorDto
  | AuthenticationErrorDto
  | AuthorizationErrorDto
  | RateLimitErrorDto
  | ErrorDto;

/**
 * Error response wrapper
 */
export interface ErrorResponseWrapperDto {
  /** Whether the request was successful */
  success: false;

  /** The error information */
  error: SpecificErrorDto;

  /** Request correlation ID */
  correlationId?: string;

  /** Response timestamp */
  timestamp: string;
}
