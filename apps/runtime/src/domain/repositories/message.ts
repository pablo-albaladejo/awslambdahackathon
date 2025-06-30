import { Message, MessageType } from '@domain/entities';
import { MessageId, SessionId, UserId } from '@domain/value-objects';

export interface MessageRepository {
  findById(id: MessageId): Promise<Message | null>;
  findBySession(sessionId: SessionId): Promise<Message[]>;
  findByUser(userId: UserId): Promise<Message[]>;
  findByType(type: MessageType): Promise<Message[]>;
  save(message: Message): Promise<void>;
  delete(id: MessageId): Promise<void>;
  exists(id: MessageId): Promise<boolean>;
  findRecentMessages(userId: UserId, limit: number): Promise<Message[]>;
  findMessagesByDateRange(
    userId: UserId,
    startDate: Date,
    endDate: Date
  ): Promise<Message[]>;
  countByUser(userId: UserId): Promise<number>;
  countBySession(sessionId: SessionId): Promise<number>;
}
