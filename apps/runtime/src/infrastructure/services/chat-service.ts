import { logger } from '@awslambdahackathon/utils/lambda';
import { MESSAGE_CONFIG } from '@config/constants';
import { container } from '@config/container';
import { Message, MessageType } from '@domain/entities';
import { MessageRepository } from '@domain/repositories/message';
import { SessionRepository } from '@domain/repositories/session';
import { UserRepository } from '@domain/repositories/user';
import {
  ChatService as DomainChatService,
  MessageValidationResult,
  ProcessMessageCommand,
  ProcessMessageResult,
} from '@domain/services/chat-service';
import { SessionId, UserId } from '@domain/value-objects';

export class ChatService implements DomainChatService {
  private readonly userRepository: UserRepository;
  private readonly messageRepository: MessageRepository;
  private readonly sessionRepository: SessionRepository;

  constructor() {
    this.userRepository = container.get<UserRepository>('UserRepository');
    this.messageRepository =
      container.get<MessageRepository>('MessageRepository');
    this.sessionRepository =
      container.get<SessionRepository>('SessionRepository');
  }

  async processMessage(
    command: ProcessMessageCommand
  ): Promise<ProcessMessageResult> {
    // Start performance monitoring for chat message processing
    const performanceMonitor = container
      .getPerformanceMonitoringService()
      .startMonitoring('chat_message_processing', {
        userId: command.userId.getValue(),
        sessionId: command.sessionId.getValue(),
        messageLength: command.content?.length,
        messageType: command.messageType,
        operation: 'chat_message_processing',
        service: 'chat',
      });

    try {
      // Convert messageType to MessageType enum
      const messageType = this.convertToMessageType(command.messageType);

      // Validate the message first
      const validationResult = await this.validateMessage(
        Message.fromData({
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          content: command.content,
          type: messageType,
          userId: command.userId.getValue(),
          sessionId: command.sessionId.getValue(),
          createdAt: new Date(),
        })
      );

      if (!validationResult.isValid) {
        throw new Error(validationResult.error || 'Message validation failed');
      }

      // Check if user can send message
      const canSend = await this.canUserSendMessage(command.userId);
      if (!canSend) {
        throw new Error('User is not allowed to send messages');
      }

      const now = new Date();
      const message = Message.fromData({
        id: `${MESSAGE_CONFIG.ID_PREFIX.MESSAGE}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: command.content,
        type: messageType,
        userId: command.userId.getValue(),
        sessionId: command.sessionId.getValue(),
        createdAt: now,
      });

      // Store the message using repository
      await this.messageRepository.save(message);

      // Create echo message if it's a user message
      let echoMessage: Message | null = null;
      let isEcho = false;

      if (command.messageType === 'user') {
        echoMessage = await this.createEchoMessage(message);
        await this.messageRepository.save(echoMessage);
        isEcho = true;
      }

      performanceMonitor.complete(true);

      return {
        message: echoMessage || message,
        sessionId: command.sessionId,
        isEcho,
      };
    } catch (error) {
      performanceMonitor.complete(false);

      throw error;
    }
  }

  async validateMessage(message: Message): Promise<MessageValidationResult> {
    try {
      // Check if message content is not empty
      if (!message.getContent() || message.getContent().trim().length === 0) {
        return {
          isValid: false,
          error: 'Message content cannot be empty',
        };
      }

      // Check message length (max 1000 characters)
      if (message.getContent().length > MESSAGE_CONFIG.MAX_CONTENT_LENGTH) {
        return {
          isValid: false,
          error: `Message content is too long (max ${MESSAGE_CONFIG.MAX_CONTENT_LENGTH} characters)`,
        };
      }

      // Check if message type is valid
      const validTypes = [
        MessageType.USER,
        MessageType.BOT,
        MessageType.SYSTEM,
      ];
      if (!validTypes.includes(message.getType())) {
        return {
          isValid: false,
          error: 'Invalid message type',
        };
      }

      // Check if timestamp is not in the future
      if (message.getCreatedAt() > new Date()) {
        return {
          isValid: false,
          error: 'Message timestamp cannot be in the future',
        };
      }

      return { isValid: true };
    } catch (error) {
      logger.error('Error validating message', {
        messageId: message.getId().getValue(),
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        isValid: false,
        error: 'Message validation failed',
      };
    }
  }

  async createEchoMessage(originalMessage: Message): Promise<Message> {
    const now = new Date();
    return Message.fromData({
      id: `${MESSAGE_CONFIG.ID_PREFIX.ECHO}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      content: `Echo: ${originalMessage.getContent()}`,
      type: MessageType.BOT,
      userId: originalMessage.getUserId().getValue(),
      sessionId: originalMessage.getSessionId().getValue(),
      createdAt: now,
    });
  }

  async canUserSendMessage(userId: UserId): Promise<boolean> {
    try {
      // Check if user exists and is active
      const user = await this.userRepository.findById(userId);

      if (!user) {
        return false;
      }

      // Add any additional business logic here
      // For example, check if user is suspended, has exceeded rate limits, etc.

      return true;
    } catch (error) {
      logger.error('Error checking if user can send message', {
        userId: userId.getValue(),
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private convertToMessageType(
    messageType: 'user' | 'bot' | 'system'
  ): MessageType {
    switch (messageType) {
      case 'user':
        return MessageType.USER;
      case 'bot':
        return MessageType.BOT;
      case 'system':
        return MessageType.SYSTEM;
      default:
        return MessageType.USER;
    }
  }

  async storeAndEchoMessage({
    connectionId,
    message,
    sessionId,
  }: {
    connectionId: string;
    message: string;
    sessionId?: string;
  }): Promise<{ message: string; sessionId: string }> {
    try {
      // Get or create session
      const session = sessionId
        ? await this.sessionRepository.findById(SessionId.create(sessionId))
        : null;

      const finalSessionId =
        session?.getId() || SessionId.create(`session_${Date.now()}`);

      // Create user message
      const userMessage = Message.fromData({
        id: `${MESSAGE_CONFIG.ID_PREFIX.MESSAGE}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: message,
        type: MessageType.USER,
        userId: 'system', // This should come from authentication
        sessionId: finalSessionId.getValue(),
        createdAt: new Date(),
      });

      // Store user message
      await this.messageRepository.save(userMessage);

      // Create and store echo message
      const echoMessage = Message.fromData({
        id: `${MESSAGE_CONFIG.ID_PREFIX.ECHO}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: `Echo: ${message}`,
        type: MessageType.BOT,
        userId: 'system',
        sessionId: finalSessionId.getValue(),
        createdAt: new Date(),
      });

      await this.messageRepository.save(echoMessage);

      return {
        message: echoMessage.getContent(),
        sessionId: finalSessionId.getValue(),
      };
    } catch (error) {
      logger.error('Error storing and echoing message', {
        connectionId,
        message,
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
