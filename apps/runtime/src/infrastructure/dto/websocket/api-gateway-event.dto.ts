/**
 * API Gateway WebSocket event DTO
 * Represents the structure of events received from API Gateway WebSocket
 */
export interface APIGatewayWebSocketEventDto {
  /** Request context */
  requestContext: {
    /** Route key */
    routeKey: string;

    /** Message ID */
    messageId?: string;

    /** Event type */
    eventType: 'CONNECT' | 'MESSAGE' | 'DISCONNECT';

    /** Extended request ID */
    extendedRequestId: string;

    /** Request time */
    requestTime: string;

    /** Message direction */
    messageDirection: 'IN' | 'OUT';

    /** Stage */
    stage: string;

    /** Connection ID */
    connectionId: string;

    /** Request time epoch */
    requestTimeEpoch: number;

    /** Identity */
    identity: {
      /** Source IP */
      sourceIp: string;

      /** User agent */
      userAgent?: string;

      /** Access key */
      accessKey?: string;

      /** Caller */
      caller?: string;

      /** User */
      user?: string;

      /** User ARN */
      userArn?: string;
    };

    /** Request ID */
    requestId: string;

    /** Domain name */
    domainName: string;

    /** Connection at */
    connectedAt?: number;

    /** API ID */
    apiId: string;
  };

  /** Message body */
  body?: string;

  /** Is base64 encoded */
  isBase64Encoded: boolean;

  /** Headers */
  headers?: Record<string, string>;

  /** Multi value headers */
  multiValueHeaders?: Record<string, string[]>;

  /** Query string parameters */
  queryStringParameters?: Record<string, string> | null;

  /** Multi value query string parameters */
  multiValueQueryStringParameters?: Record<string, string[]> | null;

  /** Path parameters */
  pathParameters?: Record<string, string> | null;

  /** Stage variables */
  stageVariables?: Record<string, string> | null;
}

/**
 * API Gateway WebSocket response DTO
 */
export interface APIGatewayWebSocketResponseDto {
  /** Status code */
  statusCode: number;

  /** Headers */
  headers?: Record<string, string>;

  /** Multi value headers */
  multiValueHeaders?: Record<string, string[]>;

  /** Response body */
  body?: string;

  /** Is base64 encoded */
  isBase64Encoded?: boolean;
}

/**
 * API Gateway WebSocket message DTO
 */
export interface APIGatewayWebSocketMessageDto {
  /** Action/route */
  action: string;

  /** Message data */
  data?: Record<string, unknown>;

  /** Message ID */
  messageId?: string;

  /** Correlation ID */
  correlationId?: string;

  /** Timestamp */
  timestamp?: string;

  /** Message type */
  type?: string;

  /** User ID */
  userId?: string;

  /** Session ID */
  sessionId?: string;
}

/**
 * API Gateway WebSocket connection info DTO
 */
export interface APIGatewayWebSocketConnectionDto {
  /** Connection ID */
  connectionId: string;

  /** Connection state */
  connectionState: 'CONNECTED' | 'DISCONNECTED';

  /** Connected at timestamp */
  connectedAt: number;

  /** Last active timestamp */
  lastActiveAt?: number;

  /** Identity information */
  identity: {
    sourceIp: string;
    userAgent?: string;
  };

  /** Stage */
  stage: string;

  /** Domain name */
  domainName: string;

  /** API ID */
  apiId: string;

  /** User ID (if authenticated) */
  userId?: string;

  /** Connection metadata */
  metadata?: Record<string, unknown>;
}

/**
 * API Gateway WebSocket error DTO
 */
export interface APIGatewayWebSocketErrorDto {
  /** Error type */
  errorType: string;

  /** Error message */
  errorMessage: string;

  /** Stack trace */
  trace?: string[];

  /** Request ID */
  requestId?: string;

  /** Connection ID */
  connectionId?: string;

  /** Timestamp */
  timestamp: string;
}

/**
 * API Gateway WebSocket batch message DTO
 */
export interface APIGatewayWebSocketBatchDto {
  /** Batch ID */
  batchId: string;

  /** Messages in the batch */
  messages: APIGatewayWebSocketMessageDto[];

  /** Target connection IDs */
  connectionIds: string[];

  /** Batch timestamp */
  timestamp: string;

  /** Batch metadata */
  metadata?: Record<string, unknown>;
}
