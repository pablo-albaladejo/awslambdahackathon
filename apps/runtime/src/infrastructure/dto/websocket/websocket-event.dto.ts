/**
 * Base WebSocket event DTO
 */
export interface WebSocketEventDto {
  /** Event type */
  type: string;

  /** Event timestamp */
  timestamp: string;

  /** Connection ID */
  connectionId: string;

  /** User ID (if authenticated) */
  userId?: string;

  /** Event data */
  data?: Record<string, unknown>;

  /** Request ID for correlation */
  requestId?: string;

  /** Event metadata */
  metadata?: Record<string, unknown>;
}

/**
 * WebSocket connection event DTO
 */
export interface WebSocketConnectionEventDto extends WebSocketEventDto {
  type: 'connection' | 'disconnection';

  /** Connection details */
  data: {
    /** Connection timestamp */
    connectedAt: string;

    /** Connection source (API Gateway, etc.) */
    source: string;

    /** Connection route key */
    routeKey?: string;

    /** Connection stage */
    stage?: string;

    /** Connection domain */
    domainName?: string;
  };
}

/**
 * WebSocket authentication event DTO
 */
export interface WebSocketAuthEventDto extends WebSocketEventDto {
  type: 'auth' | 'auth_success' | 'auth_failure';

  /** Authentication details */
  data: {
    /** Auth token (for auth events) */
    token?: string;

    /** User information (for success events) */
    user?: {
      id: string;
      username: string;
      email: string;
      groups: string[];
    };

    /** Error information (for failure events) */
    error?: {
      code: string;
      message: string;
      details?: unknown;
    };
  };
}

/**
 * WebSocket message event DTO
 */
export interface WebSocketMessageEventDto extends WebSocketEventDto {
  type: 'message' | 'message_sent' | 'message_received' | 'message_error';

  /** Message details */
  data: {
    /** Message ID */
    messageId: string;

    /** Message content */
    content: string;

    /** Message type */
    messageType: string;

    /** Sender user ID */
    senderId: string;

    /** Target user ID or channel */
    targetId?: string;

    /** Message timestamp */
    timestamp: string;

    /** Message metadata */
    metadata?: Record<string, unknown>;

    /** Error information (for error events) */
    error?: {
      code: string;
      message: string;
      details?: unknown;
    };
  };
}

/**
 * WebSocket ping/pong event DTO
 */
export interface WebSocketPingEventDto extends WebSocketEventDto {
  type: 'ping' | 'pong';

  /** Ping details */
  data: {
    /** Ping timestamp */
    pingTime: string;

    /** Pong timestamp (for pong events) */
    pongTime?: string;

    /** Round trip time in ms (for pong events) */
    rtt?: number;
  };
}

/**
 * WebSocket error event DTO
 */
export interface WebSocketErrorEventDto extends WebSocketEventDto {
  type: 'error';

  /** Error details */
  data: {
    /** Error code */
    code: string;

    /** Error message */
    message: string;

    /** Error details */
    details?: unknown;

    /** Stack trace (in development) */
    stack?: string;

    /** Original event that caused the error */
    originalEvent?: Record<string, unknown>;
  };
}

/**
 * WebSocket custom event DTO
 */
export interface WebSocketCustomEventDto extends WebSocketEventDto {
  type: 'custom';

  /** Custom event details */
  data: {
    /** Custom event name */
    eventName: string;

    /** Custom event payload */
    payload: Record<string, unknown>;

    /** Event version */
    version?: string;
  };
}

/**
 * Union type for all WebSocket events
 */
export type WebSocketEventUnionDto =
  | WebSocketConnectionEventDto
  | WebSocketAuthEventDto
  | WebSocketMessageEventDto
  | WebSocketPingEventDto
  | WebSocketErrorEventDto
  | WebSocketCustomEventDto;

/**
 * WebSocket event batch DTO
 */
export interface WebSocketEventBatchDto {
  /** Batch ID */
  batchId: string;

  /** Batch timestamp */
  timestamp: string;

  /** Events in the batch */
  events: WebSocketEventUnionDto[];

  /** Batch metadata */
  metadata?: Record<string, unknown>;
}
