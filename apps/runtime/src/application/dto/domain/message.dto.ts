import { MessageStatus, MessageType } from '../../../domain/entities/message';

/**
 * DTO for Message entity
 */
export interface MessageDto {
  /** Message ID */
  id: string;

  /** User ID who sent the message */
  userId: string;

  /** Message content */
  content: string;

  /** Message type */
  type: MessageType;

  /** Message status */
  status: MessageStatus;

  /** Creation timestamp */
  createdAt: string;

  /** Update timestamp */
  updatedAt: string;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * DTO for Message creation
 */
export interface CreateMessageDto {
  /** Message ID (optional, will be generated if not provided) */
  id?: string;

  /** User ID who sent the message */
  userId: string;

  /** Message content */
  content: string;

  /** Message type (defaults to 'text') */
  type?: MessageType;

  /** Message status (defaults to 'sent') */
  status?: MessageStatus;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * DTO for Message updates
 */
export interface UpdateMessageDto {
  /** Message content (optional for updates) */
  content?: string;

  /** Message status (optional for updates) */
  status?: MessageStatus;

  /** Optional metadata (optional for updates) */
  metadata?: Record<string, unknown>;
}
