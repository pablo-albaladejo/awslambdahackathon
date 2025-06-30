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

  /** User ID (optional) */
  userId?: string;

  /** Request ID for tracking */
  requestId?: string;
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

    /** Event source */
    source: 'API_GATEWAY' | 'MANUAL';

    /** Route key */
    routeKey: string;

    /** Stage */
    stage: string;

    /** Domain name */
    domainName: string;
  };

  /** Connection metadata */
  metadata?: {
    connectionStatus?: string;
    lastActivity?: string;
    userAgent?: string;
    ipAddress?: string;
  };
}

/**
 * WebSocket authentication event DTO
 */
export interface WebSocketAuthEventDto extends WebSocketEventDto {
  type: 'auth_success' | 'auth_failure' | 'auth_required';

  /** Authentication details */
  data: {
    /** User information (for success) */
    user?: {
      id: string;
      username: string;
      email: string;
      groups: string[];
    };

    /** Error information (for failure) */
    error?: {
      code: string;
      message: string;
      details?: unknown;
    };

    /** Token information */
    token?: {
      type: string;
      expiresAt?: string;
    };
  };

  /** Auth metadata */
  metadata?: {
    userActive?: boolean;
    lastActivity?: string;
    authMethod?: string;
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

  /** Message metadata */
  metadata?: {
    messageStatus?: string;
    sessionId?: string;
    replyToMessageId?: string;
  };
}

/**
 * WebSocket ping event DTO
 */
export interface WebSocketPingEventDto extends WebSocketEventDto {
  type: 'ping' | 'pong';

  /** Ping details */
  data: {
    /** Ping timestamp */
    pingTime: string;

    /** Pong timestamp (for pong events) */
    pongTime?: string;

    /** Round trip time in ms */
    rtt?: number;
  };
}

/**
 * WebSocket error event DTO
 */
export interface WebSocketErrorEventDto extends WebSocketEventDto {
  type: 'error' | 'warning';

  /** Error details */
  data: {
    /** Error code */
    code: string;

    /** Error message */
    message: string;

    /** Error details */
    details?: unknown;

    /** Stack trace (for debugging) */
    stack?: string;
  };

  /** Error metadata */
  metadata?: {
    severity?: 'low' | 'medium' | 'high' | 'critical';
    category?: string;
    retryable?: boolean;
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

    /** Custom payload */
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
