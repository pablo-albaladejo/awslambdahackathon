import { z } from 'zod';

import { IdSchema, TimestampSchema } from './schemas';

// Chat message schema
export const ChatMessageDataSchema = z.object({
  id: IdSchema,
  text: z.string().min(1).max(10000), // Max 10KB message
  isUser: z.boolean(),
  timestamp: TimestampSchema,
  sessionId: IdSchema.optional(),
  userId: IdSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Message status schema
export const MessageStatusSchema = z.enum([
  'pending',
  'sent',
  'delivered',
  'read',
  'failed',
  'deleted',
]);

// Message with status schema
export const MessageWithStatusSchema = ChatMessageDataSchema.extend({
  status: MessageStatusSchema,
  deliveredAt: TimestampSchema.optional(),
  readAt: TimestampSchema.optional(),
  error: z.string().optional(),
});

// Chat session schema
export const ChatSessionSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  title: z.string().optional(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  lastMessageAt: TimestampSchema.optional(),
  messageCount: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  metadata: z.record(z.unknown()).optional(),
});

// Message thread schema (for grouping related messages)
export const MessageThreadSchema = z.object({
  id: IdSchema,
  sessionId: IdSchema,
  messages: z.array(MessageWithStatusSchema),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  isResolved: z.boolean().default(false),
  resolvedAt: TimestampSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Message search criteria schema
export const MessageSearchCriteriaSchema = z.object({
  sessionId: IdSchema.optional(),
  userId: IdSchema.optional(),
  text: z.string().optional(),
  startDate: TimestampSchema.optional(),
  endDate: TimestampSchema.optional(),
  status: MessageStatusSchema.optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).default(0),
});

// Message analytics schema
export const MessageAnalyticsSchema = z.object({
  sessionId: IdSchema,
  totalMessages: z.number().int().min(0),
  userMessages: z.number().int().min(0),
  botMessages: z.number().int().min(0),
  averageResponseTime: z.number().min(0).optional(),
  sessionDuration: z.number().min(0).optional(),
  startTime: TimestampSchema,
  endTime: TimestampSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Message template schema
export const MessageTemplateSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  content: z.string().min(1),
  variables: z.array(z.string()).default([]),
  category: z.string().optional(),
  isActive: z.boolean().default(true),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  createdBy: IdSchema,
});

// Type exports
export type ChatMessageData = z.infer<typeof ChatMessageDataSchema>;
export type MessageStatus = z.infer<typeof MessageStatusSchema>;
export type MessageWithStatus = z.infer<typeof MessageWithStatusSchema>;
export type ChatSession = z.infer<typeof ChatSessionSchema>;
export type MessageThread = z.infer<typeof MessageThreadSchema>;
export type MessageSearchCriteria = z.infer<typeof MessageSearchCriteriaSchema>;
export type MessageAnalytics = z.infer<typeof MessageAnalyticsSchema>;
export type MessageTemplate = z.infer<typeof MessageTemplateSchema>;

// Helper functions for message validation
export const validateChatMessageData = (data: unknown): ChatMessageData => {
  return ChatMessageDataSchema.parse(data);
};

export const validateMessageWithStatus = (data: unknown): MessageWithStatus => {
  return MessageWithStatusSchema.parse(data);
};

// Message factory functions
export const createChatMessageData = (
  text: string,
  isUser: boolean,
  sessionId?: string,
  userId?: string
): ChatMessageData => ({
  id: crypto.randomUUID(),
  text,
  isUser,
  timestamp: new Date().toISOString(),
  sessionId,
  userId,
});

export const createMessageWithStatus = (
  message: ChatMessageData,
  status: MessageStatus = 'pending'
): MessageWithStatus => ({
  ...message,
  status,
});

export const createChatSession = (
  userId: string,
  title?: string
): ChatSession => ({
  id: crypto.randomUUID(),
  userId,
  title,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  messageCount: 0,
  isActive: true,
});

// Message utility functions
export const isMessageFromUser = (message: ChatMessageData): boolean => {
  return message.isUser;
};

export const isMessageFromBot = (message: ChatMessageData): boolean => {
  return !message.isUser;
};

export const getMessageAge = (message: ChatMessageData): number => {
  return Date.now() - new Date(message.timestamp).getTime();
};

export const isMessageRecent = (
  message: ChatMessageData,
  thresholdMs: number = 60000
): boolean => {
  return getMessageAge(message) < thresholdMs;
};

export const formatMessageTime = (message: ChatMessageData): string => {
  return new Date(message.timestamp).toLocaleTimeString();
};

export const formatMessageDate = (message: ChatMessageData): string => {
  return new Date(message.timestamp).toLocaleDateString();
};

// Message search and filtering functions
export const filterMessagesBySession = (
  messages: ChatMessageData[],
  sessionId: string
): ChatMessageData[] => {
  return messages.filter(message => message.sessionId === sessionId);
};

export const filterMessagesByUser = (
  messages: ChatMessageData[],
  userId: string
): ChatMessageData[] => {
  return messages.filter(message => message.userId === userId);
};

export const filterMessagesByDateRange = (
  messages: ChatMessageData[],
  startDate: Date,
  endDate: Date
): ChatMessageData[] => {
  return messages.filter(message => {
    const messageDate = new Date(message.timestamp);
    return messageDate >= startDate && messageDate <= endDate;
  });
};

export const searchMessagesByText = (
  messages: ChatMessageData[],
  searchText: string
): ChatMessageData[] => {
  const lowerSearchText = searchText.toLowerCase();
  return messages.filter(message =>
    message.text.toLowerCase().includes(lowerSearchText)
  );
};

// Message analytics functions
export const calculateSessionAnalytics = (
  messages: ChatMessageData[],
  sessionId: string
): MessageAnalytics => {
  const sessionMessages = filterMessagesBySession(messages, sessionId);
  const userMessages = sessionMessages.filter(isMessageFromUser);
  const botMessages = sessionMessages.filter(isMessageFromBot);

  const startTime = sessionMessages[0]?.timestamp || new Date().toISOString();
  const endTime = sessionMessages[sessionMessages.length - 1]?.timestamp;

  return {
    sessionId,
    totalMessages: sessionMessages.length,
    userMessages: userMessages.length,
    botMessages: botMessages.length,
    startTime,
    endTime,
  };
};
