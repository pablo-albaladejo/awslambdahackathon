import {
  MessageData,
  MessageValidator,
} from '@domain/validation/validators/message-validator';
import { MessageId, SessionId, UserId } from '@domain/value-objects';

export enum MessageType {
  TEXT = 'text',
  SYSTEM = 'system',
  ADMIN = 'admin',
}

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
  PENDING = 'pending',
}

export class Message {
  constructor(
    private readonly id: MessageId,
    private readonly content: string,
    private readonly type: MessageType,
    private readonly userId: UserId,
    private readonly sessionId: SessionId,
    private readonly status: MessageStatus = MessageStatus.SENT,
    private readonly createdAt: Date = new Date(),
    private readonly metadata: Record<string, unknown> = {},
    private readonly replyToMessageId?: MessageId
  ) {
    this.validate();
  }

  getId(): MessageId {
    return this.id;
  }

  getContent(): string {
    return this.content;
  }

  getType(): MessageType {
    return this.type;
  }

  getUserId(): UserId {
    return this.userId;
  }

  getSessionId(): SessionId {
    return this.sessionId;
  }

  getStatus(): MessageStatus {
    return this.status;
  }

  getCreatedAt(): Date {
    return new Date(this.createdAt);
  }

  getMetadata(): Record<string, unknown> {
    return { ...this.metadata }; // Return a copy to prevent external modification
  }

  getReplyToMessageId(): MessageId | undefined {
    return this.replyToMessageId;
  }

  isTextMessage(): boolean {
    return this.type === MessageType.TEXT;
  }

  isSystemMessage(): boolean {
    return this.type === MessageType.SYSTEM;
  }

  isAdminMessage(): boolean {
    return this.type === MessageType.ADMIN;
  }

  isReply(): boolean {
    return this.replyToMessageId !== undefined;
  }

  isDelivered(): boolean {
    return (
      this.status === MessageStatus.DELIVERED ||
      this.status === MessageStatus.READ
    );
  }

  isRead(): boolean {
    return this.status === MessageStatus.READ;
  }

  isFailed(): boolean {
    return this.status === MessageStatus.FAILED;
  }

  getContentLength(): number {
    return this.content.length;
  }

  isEmpty(): boolean {
    return this.content.trim().length === 0;
  }

  containsKeyword(keyword: string): boolean {
    return this.content.toLowerCase().includes(keyword.toLowerCase());
  }

  markAsDelivered(): Message {
    return new Message(
      this.id,
      this.content,
      this.type,
      this.userId,
      this.sessionId,
      MessageStatus.DELIVERED,
      this.createdAt,
      this.metadata,
      this.replyToMessageId
    );
  }

  markAsRead(): Message {
    return new Message(
      this.id,
      this.content,
      this.type,
      this.userId,
      this.sessionId,
      MessageStatus.READ,
      this.createdAt,
      this.metadata,
      this.replyToMessageId
    );
  }

  markAsFailed(): Message {
    return new Message(
      this.id,
      this.content,
      this.type,
      this.userId,
      this.sessionId,
      MessageStatus.FAILED,
      this.createdAt,
      this.metadata,
      this.replyToMessageId
    );
  }

  addMetadata(key: string, value: unknown): Message {
    const newMetadata = { ...this.metadata, [key]: value };
    return new Message(
      this.id,
      this.content,
      this.type,
      this.userId,
      this.sessionId,
      this.status,
      this.createdAt,
      newMetadata,
      this.replyToMessageId
    );
  }

  removeMetadata(key: string): Message {
    const newMetadata = { ...this.metadata };
    delete newMetadata[key];
    return new Message(
      this.id,
      this.content,
      this.type,
      this.userId,
      this.sessionId,
      this.status,
      this.createdAt,
      newMetadata,
      this.replyToMessageId
    );
  }

  reply(content: string, replyUserId: UserId): Message {
    return new Message(
      MessageId.generate(),
      content,
      this.type,
      replyUserId,
      this.sessionId,
      MessageStatus.SENT,
      new Date(),
      {},
      this.id
    );
  }

  private validate(): void {
    const messageData: MessageData = {
      content: this.content,
      type: this.type,
      userId: this.userId.getValue(),
      sessionId: this.sessionId.getValue(),
      status: this.status,
      createdAt: this.createdAt,
      metadata: this.metadata,
      replyToMessageId: this.replyToMessageId?.getValue(),
    };

    MessageValidator.validateAndThrow(messageData);
  }

  static createTextMessage(
    content: string,
    userId: UserId,
    sessionId: SessionId
  ): Message {
    return new Message(
      MessageId.generate(),
      content,
      MessageType.TEXT,
      userId,
      sessionId
    );
  }

  static createSystemMessage(
    content: string,
    userId: UserId,
    sessionId: SessionId
  ): Message {
    return new Message(
      MessageId.generate(),
      content,
      MessageType.SYSTEM,
      userId,
      sessionId
    );
  }

  static createAdminMessage(
    content: string,
    userId: UserId,
    sessionId: SessionId
  ): Message {
    return new Message(
      MessageId.generate(),
      content,
      MessageType.ADMIN,
      userId,
      sessionId
    );
  }

  static fromData(data: {
    id: string;
    content: string;
    type: MessageType;
    userId: string;
    sessionId: string;
    status?: MessageStatus;
    createdAt?: Date;
    metadata?: Record<string, unknown>;
    replyToMessageId?: string;
  }): Message {
    return new Message(
      MessageId.create(data.id),
      data.content,
      data.type,
      UserId.create(data.userId),
      SessionId.create(data.sessionId),
      data.status || MessageStatus.SENT,
      data.createdAt || new Date(),
      data.metadata || {},
      data.replyToMessageId
        ? MessageId.create(data.replyToMessageId)
        : undefined
    );
  }
}
