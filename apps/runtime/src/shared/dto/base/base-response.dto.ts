/**
 * Base interface for all response DTOs
 * Provides common fields that should be present in all responses
 */
export interface BaseResponseDto {
  /** Indicates if the operation was successful */
  success: boolean;

  /** Correlation ID from the original request */
  correlationId?: string;

  /** Timestamp when the response was created */
  timestamp: string;

  /** Additional metadata for the response */
  metadata?: Record<string, unknown>;

  /** Response version */
  version?: string;
}

/**
 * Base interface for successful responses with data
 */
export interface SuccessResponseDto<TData = unknown> extends BaseResponseDto {
  success: true;

  /** The response data */
  data: TData;

  /** Optional message describing the success */
  message?: string;
}

/**
 * Base interface for error responses
 */
export interface ErrorResponseDto extends BaseResponseDto {
  success: false;

  /** Error message */
  error: string;

  /** Error code for programmatic handling */
  errorCode?: string;

  /** Detailed error information */
  details?: Record<string, unknown>;

  /** Stack trace (only in development) */
  stack?: string;
}

/**
 * Base interface for paginated responses
 */
export interface PaginatedResponseDto<TData = unknown>
  extends SuccessResponseDto<TData[]> {
  /** Pagination information */
  pagination: {
    /** Total number of items */
    total: number;

    /** Current page size */
    limit: number;

    /** Current offset */
    offset: number;

    /** Whether there are more items */
    hasMore: boolean;

    /** Cursor for next page (if using cursor-based pagination) */
    nextCursor?: string;

    /** Cursor for previous page (if using cursor-based pagination) */
    prevCursor?: string;
  };
}

/**
 * Union type for all possible response types
 */
export type ApiResponseDto<TData = unknown> =
  | SuccessResponseDto<TData>
  | ErrorResponseDto;

/**
 * Type guard to check if response is successful
 */
export function isSuccessResponse<TData>(
  response: ApiResponseDto<TData>
): response is SuccessResponseDto<TData> {
  return response.success === true;
}

/**
 * Type guard to check if response is an error
 */
export function isErrorResponse<TData>(
  response: ApiResponseDto<TData>
): response is ErrorResponseDto {
  return response.success === false;
}
