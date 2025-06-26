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
      email: z.string().email(),
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
  status: z.enum(['active', 'inactive', 'disconnected']),
  metadata: z.record(z.unknown()).optional(),
});

// Type exports
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
    timestamp: new Date().toISOString(),
  },
});
