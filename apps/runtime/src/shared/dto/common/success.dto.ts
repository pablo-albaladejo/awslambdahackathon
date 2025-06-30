/**
 * Common success response DTO
 */
export interface SuccessDto<TData = unknown> {
  /** Whether the request was successful */
  success: true;

  /** The response data */
  data: TData;

  /** Success message */
  message?: string;

  /** Response timestamp */
  timestamp: string;

  /** Request correlation ID */
  correlationId?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Success response for operations that don't return data
 */
export interface OperationSuccessDto {
  /** Whether the operation was successful */
  success: true;

  /** Success message */
  message: string;

  /** Operation timestamp */
  timestamp: string;

  /** Request correlation ID */
  correlationId?: string;

  /** Operation metadata */
  metadata?: {
    /** Operation duration in milliseconds */
    duration?: number;

    /** Number of items affected */
    affectedItems?: number;

    /** Operation type */
    operationType?: string;

    /** Additional operation details */
    details?: Record<string, unknown>;
  };
}

/**
 * Success response for batch operations
 */
export interface BatchOperationSuccessDto<TData = unknown> {
  /** Whether the batch operation was successful */
  success: true;

  /** Processed items */
  data: TData[];

  /** Batch operation summary */
  summary: {
    /** Total number of items processed */
    totalItems: number;

    /** Number of successful operations */
    successCount: number;

    /** Number of failed operations */
    failureCount: number;

    /** Processing duration in milliseconds */
    duration: number;
  };

  /** Individual item results */
  itemResults?: Array<{
    /** Item index */
    index: number;

    /** Whether this item was processed successfully */
    success: boolean;

    /** Error message (if failed) */
    error?: string;

    /** Item data (if successful) */
    data?: TData;
  }>;

  /** Response timestamp */
  timestamp: string;

  /** Request correlation ID */
  correlationId?: string;
}

/**
 * Success response for async operations
 */
export interface AsyncOperationSuccessDto {
  /** Whether the async operation was initiated successfully */
  success: true;

  /** Operation ID for tracking */
  operationId: string;

  /** Operation status */
  status: 'initiated' | 'in_progress' | 'completed' | 'failed';

  /** Estimated completion time */
  estimatedCompletion?: string;

  /** Progress percentage (0-100) */
  progress?: number;

  /** Status check URL */
  statusUrl?: string;

  /** Success message */
  message: string;

  /** Response timestamp */
  timestamp: string;

  /** Request correlation ID */
  correlationId?: string;
}
