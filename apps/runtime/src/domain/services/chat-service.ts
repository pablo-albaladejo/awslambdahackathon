import { Message } from '@domain/entities';
import { SessionId, UserId } from '@domain/value-objects';

export interface ProcessMessageCommand {
  content: string;
  userId: UserId;
  sessionId: SessionId;
  messageType: 'user' | 'bot' | 'system';
}

export interface ProcessMessageResult {
  userMessage: Message;
  botMessage: Message;
  sessionId: SessionId;
}

export interface MessageValidationResult {
  isValid: boolean;
  error?: string;
}

export interface ChatService {
  processMessage(command: ProcessMessageCommand): Promise<ProcessMessageResult>;
  validateMessage(message: Message): Promise<MessageValidationResult>;
  canUserSendMessage(userId: UserId): Promise<boolean>;
}
