/**
 * Shared DTO types for entities across all modules
 */

/**
 * User DTO for API responses and serialization
 */
export interface UserDto {
  id: string;
  username: string;
  groups: string[];
  createdAt: string; // ISO string
  lastActivityAt: string; // ISO string
  isActive: boolean;
}

/**
 * Connection DTO for WebSocket and API operations
 */
export interface ConnectionDto {
  id: string;
  userId: string;
  sessionId?: string;
  connectedAt: string; // ISO string
  lastPingAt?: string; // ISO string
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Message DTO for chat operations
 */
export interface MessageDto {
  id: string;
  content: string;
  senderId: string;
  sessionId?: string;
  timestamp: string; // ISO string
  type: 'text' | 'system' | 'notification';
  metadata?: Record<string, unknown>;
}

/**
 * Session DTO for session management
 */
export interface SessionDto {
  id: string;
  userId: string;
  createdAt: string; // ISO string
  expiresAt: string; // ISO string
  isActive: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Error DTO for consistent error responses
 */
export interface ErrorDto {
  name: string;
  message: string;
  code: string;
  details?: Record<string, unknown>;
  correlationId?: string;
  timestamp: string; // ISO string
  stack?: string; // Only in development
}

/**
 * Paginated response DTO
 */
export interface PaginatedDto<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

/**
 * API Response wrapper DTO
 */
export interface ApiResponseDto<T> {
  success: boolean;
  data?: T;
  error?: ErrorDto;
  meta?: {
    timestamp: string;
    correlationId?: string;
    version: string;
  };
}
