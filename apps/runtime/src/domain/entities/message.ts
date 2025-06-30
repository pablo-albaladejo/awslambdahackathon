import { MessageId, SessionId, UserId } from '../value-objects';

export enum MessageType {
  USER = 'user',
  BOT = 'bot',
  SYSTEM = 'system',
  ADMIN = 'admin'
}

export enum MessageStatus {
  SENT = 'sent',
  DELIVERED = 'delivered',
  READ = 'read',
  FAILED = 'failed',
  PENDING = 'pending'
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

  isUserMessage(): boolean {
    return this.type === MessageType.USER;
  }

  isBotMessage(): boolean {
    return this.type === MessageType.BOT;
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
    return this.status === MessageStatus.DELIVERED || this.status === MessageStatus.READ;
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
    if (!this.content || this.content.trim().length === 0) {
      throw new Error('Message content cannot be empty');
    }

    if (this.content.length > 10000) {
      throw new Error('Message content cannot exceed 10000 characters');
    }

    if (!Object.values(MessageType).includes(this.type)) {
      throw new Error('Invalid message type');
    }

    if (!Object.values(MessageStatus).includes(this.status)) {
      throw new Error('Invalid message status');
    }

    if (!this.id) {
      throw new Error('Message ID is required');
    }

    if (!this.userId) {
      throw new Error('User ID is required');
    }

    if (!this.sessionId) {
      throw new Error('Session ID is required');
    }

    if (this.createdAt > new Date()) {
      throw new Error('Created date cannot be in the future');
    }
  }

  static createUserMessage(
    content: string,
    userId: UserId,
    sessionId: SessionId
  ): Message {
    return new Message(
      MessageId.generate(),
      content,
      MessageType.USER,
      userId,
      sessionId
    );
  }

  static createBotMessage(
    content: string,
    userId: UserId,
    sessionId: SessionId
  ): Message {
    return new Message(
      MessageId.generate(),
      content,
      MessageType.BOT,
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
      data.replyToMessageId ? MessageId.create(data.replyToMessageId) : undefined
    );
  }
} 