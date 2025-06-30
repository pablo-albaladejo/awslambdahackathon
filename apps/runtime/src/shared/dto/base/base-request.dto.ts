/**
 * Base interface for all request DTOs
 * Provides common fields that should be present in all requests
 */
export interface BaseRequestDto {
  /** Unique identifier for request tracing */
  correlationId?: string;

  /** Timestamp when the request was created */
  timestamp?: string;

  /** Additional metadata for the request */
  metadata?: Record<string, unknown>;

  /** Source of the request (e.g., 'web', 'mobile', 'api') */
  source?: string;

  /** Version of the API being used */
  version?: string;
}

/**
 * Base interface for paginated requests
 */
export interface PaginatedRequestDto extends BaseRequestDto {
  /** Number of items to return per page */
  limit?: number;

  /** Offset for pagination */
  offset?: number;

  /** Cursor for cursor-based pagination */
  cursor?: string;

  /** Sort field */
  sortBy?: string;

  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Base interface for filtered requests
 */
export interface FilteredRequestDto extends BaseRequestDto {
  /** Filter criteria */
  filters?: Record<string, unknown>;

  /** Search query */
  search?: string;
}
