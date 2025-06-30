/**
 * API Gateway WebSocket event DTO
 */
export interface APIGatewayWebSocketEventDto {
  /** Request context */
  requestContext: {
    /** Route key */
    routeKey: string;

    /** Connection ID */
    connectionId: string;

    /** Event type */
    eventType: 'CONNECT' | 'DISCONNECT' | 'MESSAGE';

    /** Request ID */
    requestId: string;

    /** API ID */
    apiId: string;

    /** Domain name */
    domainName: string;

    /** Stage */
    stage: string;

    /** Request time */
    requestTime: string;

    /** Request time epoch */
    requestTimeEpoch: number;

    /** Identity information */
    identity: {
      sourceIp: string;
      userAgent?: string;
    };
  };

  /** Message body (for MESSAGE events) */
  body?: string;

  /** Query string parameters */
  queryStringParameters?: Record<string, string>;

  /** Headers */
  headers?: Record<string, string>;

  /** Multi-value headers */
  multiValueHeaders?: Record<string, string[]>;

  /** Path parameters */
  pathParameters?: Record<string, string>;

  /** Stage variables */
  stageVariables?: Record<string, string>;

  /** Is base64 encoded */
  isBase64Encoded?: boolean;
}

/**
 * API Gateway WebSocket response DTO
 */
export interface APIGatewayWebSocketResponseDto {
  /** Status code */
  statusCode: number;

  /** Response body */
  body?: string;

  /** Response headers */
  headers?: Record<string, string>;

  /** Multi-value headers */
  multiValueHeaders?: Record<string, string[]>;

  /** Is base64 encoded */
  isBase64Encoded?: boolean;
}

/**
 * API Gateway WebSocket message DTO
 */
export interface APIGatewayWebSocketMessageDto {
  /** Action type */
  action: string;

  /** Message data */
  data: Record<string, unknown>;

  /** Message ID */
  messageId?: string;

  /** Timestamp */
  timestamp?: string;

  /** Message type */
  type?: string;

  /** User ID */
  userId?: string;

  /** Session ID */
  sessionId?: string;

  /** Request ID for tracking */
  requestId?: string;
}

/**
 * API Gateway WebSocket connection info DTO
 */
export interface APIGatewayWebSocketConnectionDto {
  /** Connection ID */
  connectionId: string;

  /** Connected timestamp */
  connectedAt: string;

  /** Last activity timestamp */
  lastActivityAt: string;

  /** Connection status */
  status: 'CONNECTED' | 'DISCONNECTED' | 'IDLE';

  /** User ID (if authenticated) */
  userId?: string;

  /** Connection metadata */
  metadata: {
    sourceIp: string;
    userAgent?: string;
    stage: string;
    domainName: string;
  };
}

/**
 * API Gateway WebSocket error DTO
 */
export interface APIGatewayWebSocketErrorDto {
  /** Error code */
  code: string;

  /** Error message */
  message: string;

  /** Error details */
  details?: unknown;

  /** Request ID */
  requestId?: string;

  /** Connection ID */
  connectionId?: string;

  /** Timestamp */
  timestamp: string;
}
