/**
 * DTO for Connection entity
 */
export interface ConnectionDto {
  /** Connection ID */
  id: string;

  /** User ID associated with the connection */
  userId: string;

  /** Connection timestamp */
  connectedAt: string;

  /** Last activity timestamp */
  lastActivityAt: string;

  /** Whether the connection is active */
  isActive: boolean;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * DTO for Connection creation
 */
export interface CreateConnectionDto {
  /** Connection ID */
  id: string;

  /** User ID associated with the connection */
  userId: string;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * DTO for Connection updates
 */
export interface UpdateConnectionDto {
  /** Last activity timestamp (optional for updates) */
  lastActivityAt?: string;

  /** Whether the connection is active (optional for updates) */
  isActive?: boolean;

  /** Optional metadata (optional for updates) */
  metadata?: Record<string, unknown>;
}
