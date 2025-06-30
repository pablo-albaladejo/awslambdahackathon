/**
 * DTO for Session entity
 */
export interface SessionDto {
  /** Session ID */
  id: string;

  /** User ID associated with the session */
  userId: string;

  /** Session creation timestamp */
  createdAt: string;

  /** Session expiration timestamp */
  expiresAt: string;

  /** Last activity timestamp */
  lastActivityAt: string;

  /** Whether the session is active */
  isActive: boolean;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * DTO for Session creation
 */
export interface CreateSessionDto {
  /** Session ID (optional, will be generated if not provided) */
  id?: string;

  /** User ID associated with the session */
  userId: string;

  /** Session expiration timestamp */
  expiresAt: string;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * DTO for Session updates
 */
export interface UpdateSessionDto {
  /** Session expiration timestamp (optional for updates) */
  expiresAt?: string;

  /** Last activity timestamp (optional for updates) */
  lastActivityAt?: string;

  /** Whether the session is active (optional for updates) */
  isActive?: boolean;

  /** Optional metadata (optional for updates) */
  metadata?: Record<string, unknown>;
}
