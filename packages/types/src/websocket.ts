import { z } from 'zod';

import { ErrorSchema, IdSchema, TimestampSchema } from './schemas';
// WebSocket message types
export const WebSocketMessageTypeSchema = z.enum([
  'auth',
  'auth_response',
  'message',
  'message_response',
  'error',
  'system',
  'ping',
  'pong',
  'connection_status',
]);

// Base WebSocket message schema
export const BaseWebSocketMessageSchema = z.object({
  type: WebSocketMessageTypeSchema,
  id: IdSchema.optional(),
  timestamp: TimestampSchema.optional(),
  sessionId: IdSchema.optional(),
});

// Authentication message schemas
export const AuthMessageSchema = z.object({
  action: z.literal('authenticate'),
  token: z.string().min(1),
});

export const AuthResponseSchema = z.object({
  success: z.boolean(),
  userId: IdSchema.optional(),
  sessionId: IdSchema.optional(),
  error: z.string().optional(),
  user: z
    .object({
      id: IdSchema,
      username: z.string().min(1),
      groups: z.array(z.string()),
    })
    .optional(),
});

// Chat message schemas
export const ChatMessageSchema = z.object({
  action: z.literal('sendMessage'),
  message: z.string().min(1).max(10000), // Max 10KB message
  sessionId: IdSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const ChatMessageResponseSchema = z.object({
  message: z.string().min(1),
  sessionId: IdSchema,
  messageId: IdSchema,
  timestamp: TimestampSchema,
  metadata: z.record(z.unknown()).optional(),
});

// System message schema
export const SystemMessageSchema = z.object({
  action: z.enum([
    'connection_status',
    'user_joined',
    'user_left',
    'maintenance',
  ]),
  data: z.record(z.unknown()).optional(),
});

// Connection status schema
export const ConnectionStatusSchema = z.object({
  status: z.enum(['connected', 'disconnected', 'connecting', 'error']),
  timestamp: TimestampSchema,
  error: ErrorSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Ping/Pong schemas
export const PingMessageSchema = z.object({
  timestamp: TimestampSchema,
});

export const PongMessageSchema = z.object({
  timestamp: TimestampSchema,
  latency: z.number().optional(),
});

// Complete WebSocket message schemas
export const WebSocketMessageSchema = z.discriminatedUnion('type', [
  // Authentication messages
  BaseWebSocketMessageSchema.extend({
    type: z.literal('auth'),
    data: AuthMessageSchema,
  }),

  BaseWebSocketMessageSchema.extend({
    type: z.literal('auth_response'),
    data: AuthResponseSchema,
  }),

  // Chat messages
  BaseWebSocketMessageSchema.extend({
    type: z.literal('message'),
    data: ChatMessageSchema,
  }),

  BaseWebSocketMessageSchema.extend({
    type: z.literal('message_response'),
    data: ChatMessageResponseSchema,
  }),

  // System messages
  BaseWebSocketMessageSchema.extend({
    type: z.literal('system'),
    data: SystemMessageSchema,
  }),

  BaseWebSocketMessageSchema.extend({
    type: z.literal('connection_status'),
    data: ConnectionStatusSchema,
  }),

  // Error messages
  BaseWebSocketMessageSchema.extend({
    type: z.literal('error'),
    data: ErrorSchema,
  }),

  // Ping/Pong messages
  BaseWebSocketMessageSchema.extend({
    type: z.literal('ping'),
    data: PingMessageSchema,
  }),

  BaseWebSocketMessageSchema.extend({
    type: z.literal('pong'),
    data: PongMessageSchema,
  }),
]);

// WebSocket connection schema
export const WebSocketConnectionSchema = z.object({
  connectionId: IdSchema,
  userId: IdSchema.optional(),
  sessionId: IdSchema.optional(),
  connectedAt: TimestampSchema,
  lastActivityAt: TimestampSchema,
  status: z.enum(['connected', 'authenticated', 'disconnected', 'suspended']),
  metadata: z.record(z.unknown()).optional(),
});

// =============================================================================
// SERVER-SIDE WEBSOCKET EVENT DTOS
// =============================================================================

/**
 * Base WebSocket event DTO
 */
export const WebSocketEventDtoSchema = z.object({
  type: z.string(),
  timestamp: z.string(),
  connectionId: z.string(),
  userId: z.string().optional(),
  requestId: z.string().optional(),
});

/**
 * WebSocket connection event DTO
 */
export const WebSocketConnectionEventDtoSchema = WebSocketEventDtoSchema.extend(
  {
    type: z.enum(['connection', 'disconnection']),
    data: z.object({
      connectedAt: z.string(),
      source: z.enum(['API_GATEWAY', 'MANUAL']),
      routeKey: z.string(),
      stage: z.string(),
      domainName: z.string(),
    }),
    metadata: z
      .object({
        connectionStatus: z.string().optional(),
        lastActivity: z.string().optional(),
        userAgent: z.string().optional(),
        ipAddress: z.string().optional(),
      })
      .optional(),
  }
);

/**
 * WebSocket authentication event DTO
 */
export const WebSocketAuthEventDtoSchema = WebSocketEventDtoSchema.extend({
  type: z.enum(['auth_success', 'auth_failure', 'auth_required']),
  data: z.object({
    user: z
      .object({
        id: z.string(),
        username: z.string(),
        groups: z.array(z.string()),
      })
      .optional(),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        details: z.unknown().optional(),
      })
      .optional(),
    token: z
      .object({
        type: z.string(),
        expiresAt: z.string().optional(),
      })
      .optional(),
  }),
  metadata: z
    .object({
      userActive: z.boolean().optional(),
      lastActivity: z.string().optional(),
      authMethod: z.string().optional(),
    })
    .optional(),
});

/**
 * WebSocket message event DTO
 */
export const WebSocketMessageEventDtoSchema = WebSocketEventDtoSchema.extend({
  type: z.enum([
    'message',
    'message_sent',
    'message_received',
    'message_error',
  ]),
  data: z.object({
    messageId: z.string(),
    content: z.string(),
    messageType: z.string(),
    senderId: z.string(),
    targetId: z.string().optional(),
    timestamp: z.string(),
    metadata: z.record(z.unknown()).optional(),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        details: z.unknown().optional(),
      })
      .optional(),
  }),
  metadata: z
    .object({
      messageStatus: z.string().optional(),
      sessionId: z.string().optional(),
      replyToMessageId: z.string().optional(),
    })
    .optional(),
});

/**
 * WebSocket ping event DTO
 */
export const WebSocketPingEventDtoSchema = WebSocketEventDtoSchema.extend({
  type: z.enum(['ping', 'pong']),
  data: z.object({
    pingTime: z.string(),
    pongTime: z.string().optional(),
    rtt: z.number().optional(),
  }),
});

/**
 * WebSocket error event DTO
 */
export const WebSocketErrorEventDtoSchema = WebSocketEventDtoSchema.extend({
  type: z.enum(['error', 'warning']),
  data: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    stack: z.string().optional(),
  }),
  metadata: z
    .object({
      severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      category: z.string().optional(),
      retryable: z.boolean().optional(),
    })
    .optional(),
});

/**
 * WebSocket custom event DTO
 */
export const WebSocketCustomEventDtoSchema = WebSocketEventDtoSchema.extend({
  type: z.literal('custom'),
  data: z.object({
    eventName: z.string(),
    payload: z.record(z.unknown()),
    version: z.string().optional(),
  }),
});

/**
 * Union of all WebSocket event DTOs
 */
export const WebSocketEventUnionDtoSchema = z.discriminatedUnion('type', [
  WebSocketConnectionEventDtoSchema,
  WebSocketAuthEventDtoSchema,
  WebSocketMessageEventDtoSchema,
  WebSocketPingEventDtoSchema,
  WebSocketErrorEventDtoSchema,
  WebSocketCustomEventDtoSchema,
]);

// =============================================================================
// API GATEWAY WEBSOCKET EVENT DTOS
// =============================================================================

/**
 * API Gateway WebSocket event DTO
 */
export const APIGatewayWebSocketEventDtoSchema = z.object({
  requestContext: z.object({
    routeKey: z.string(),
    connectionId: z.string(),
    eventType: z.enum(['CONNECT', 'DISCONNECT', 'MESSAGE']),
    requestId: z.string(),
    apiId: z.string(),
    domainName: z.string(),
    stage: z.string(),
    requestTime: z.string(),
    requestTimeEpoch: z.number(),
    identity: z.object({
      sourceIp: z.string(),
      userAgent: z.string().optional(),
    }),
  }),
  body: z.string().optional(),
  queryStringParameters: z.record(z.string()).optional(),
  headers: z.record(z.string()).optional(),
  multiValueHeaders: z.record(z.array(z.string())).optional(),
  pathParameters: z.record(z.string()).optional(),
  stageVariables: z.record(z.string()).optional(),
  isBase64Encoded: z.boolean().optional(),
});

/**
 * API Gateway WebSocket response DTO
 */
export const APIGatewayWebSocketResponseDtoSchema = z.object({
  statusCode: z.number(),
  body: z.string().optional(),
  headers: z.record(z.string()).optional(),
  multiValueHeaders: z.record(z.array(z.string())).optional(),
  isBase64Encoded: z.boolean().optional(),
});

/**
 * API Gateway WebSocket message DTO
 */
export const APIGatewayWebSocketMessageDtoSchema = z.object({
  action: z.string(),
  data: z.record(z.unknown()),
  messageId: z.string().optional(),
  timestamp: z.string().optional(),
  type: z.string().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  requestId: z.string().optional(),
});

/**
 * API Gateway WebSocket connection info DTO
 */
export const APIGatewayWebSocketConnectionDtoSchema = z.object({
  connectionId: z.string(),
  connectedAt: z.string(),
  lastActivityAt: z.string(),
  status: z.enum(['CONNECTED', 'DISCONNECTED', 'IDLE']),
  userId: z.string().optional(),
  metadata: z.object({
    sourceIp: z.string(),
    userAgent: z.string().optional(),
    stage: z.string(),
    domainName: z.string(),
  }),
});

/**
 * API Gateway WebSocket error DTO
 */
export const APIGatewayWebSocketErrorDtoSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  requestId: z.string().optional(),
  connectionId: z.string().optional(),
  timestamp: z.string(),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

// Client-side types (used by frontend)
export type WebSocketMessageType = z.infer<typeof WebSocketMessageTypeSchema>;
export type WebSocketMessage = z.infer<typeof WebSocketMessageSchema>;
export type AuthMessage = z.infer<typeof AuthMessageSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatMessageResponse = z.infer<typeof ChatMessageResponseSchema>;
export type SystemMessage = z.infer<typeof SystemMessageSchema>;
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;
export type PingMessage = z.infer<typeof PingMessageSchema>;
export type PongMessage = z.infer<typeof PongMessageSchema>;
export type WebSocketConnection = z.infer<typeof WebSocketConnectionSchema>;

// Server-side types (used by backend)
export type WebSocketEventDto = z.infer<typeof WebSocketEventDtoSchema>;
export type WebSocketConnectionEventDto = z.infer<
  typeof WebSocketConnectionEventDtoSchema
>;
export type WebSocketAuthEventDto = z.infer<typeof WebSocketAuthEventDtoSchema>;
export type WebSocketMessageEventDto = z.infer<
  typeof WebSocketMessageEventDtoSchema
>;
export type WebSocketPingEventDto = z.infer<typeof WebSocketPingEventDtoSchema>;
export type WebSocketErrorEventDto = z.infer<
  typeof WebSocketErrorEventDtoSchema
>;
export type WebSocketCustomEventDto = z.infer<
  typeof WebSocketCustomEventDtoSchema
>;
export type WebSocketEventUnionDto = z.infer<
  typeof WebSocketEventUnionDtoSchema
>;

// API Gateway types (used by backend)
export type APIGatewayWebSocketEventDto = z.infer<
  typeof APIGatewayWebSocketEventDtoSchema
>;
export type APIGatewayWebSocketResponseDto = z.infer<
  typeof APIGatewayWebSocketResponseDtoSchema
>;
export type APIGatewayWebSocketMessageDto = z.infer<
  typeof APIGatewayWebSocketMessageDtoSchema
>;
export type APIGatewayWebSocketConnectionDto = z.infer<
  typeof APIGatewayWebSocketConnectionDtoSchema
>;
export type APIGatewayWebSocketErrorDto = z.infer<
  typeof APIGatewayWebSocketErrorDtoSchema
>;

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

// Helper functions for message validation
export const validateWebSocketMessage = (data: unknown): WebSocketMessage => {
  return WebSocketMessageSchema.parse(data);
};

export const validateAuthMessage = (data: unknown): AuthMessage => {
  return AuthMessageSchema.parse(data);
};

export const validateChatMessage = (data: unknown): ChatMessage => {
  return ChatMessageSchema.parse(data);
};

export const validateWebSocketEvent = (
  data: unknown
): WebSocketEventUnionDto => {
  return WebSocketEventUnionDtoSchema.parse(data);
};

export const validateAPIGatewayEvent = (
  data: unknown
): APIGatewayWebSocketEventDto => {
  return APIGatewayWebSocketEventDtoSchema.parse(data);
};

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

// Message factory functions
export const createAuthMessage = (token: string): WebSocketMessage => ({
  type: 'auth',
  id: crypto.randomUUID(),
  timestamp: new Date().toISOString(),
  data: {
    action: 'authenticate',
    token,
  },
});

export const createChatMessage = (
  message: string,
  sessionId?: string
): WebSocketMessage => ({
  type: 'message',
  id: crypto.randomUUID(),
  timestamp: new Date().toISOString(),
  sessionId,
  data: {
    action: 'sendMessage',
    message,
    sessionId,
  },
});

export const createPingMessage = (): WebSocketMessage => ({
  type: 'ping',
  id: crypto.randomUUID(),
  timestamp: new Date().toISOString(),
  data: {
    timestamp: new Date().toISOString(),
  },
});

export const createErrorMessage = (
  error: Error,
  code: string = 'UNKNOWN_ERROR'
): WebSocketMessage => ({
  type: 'error',
  id: crypto.randomUUID(),
  timestamp: new Date().toISOString(),
  data: {
    code,
    message: error.message,
    details: error.stack ? { stack: error.stack } : undefined,
    timestamp: new Date().toISOString(),
  },
});
