import { BaseResult, BaseUseCase } from '@application/use-cases/base-use-case';
import { Logger } from '@awslambdahackathon/types';
import { Message } from '@domain/entities/message';
import { MessageValidationException } from '@domain/errors/domain-errors';
import { ChatService } from '@domain/services/chat-service';
import { PerformanceMonitoringService } from '@domain/services/performance-monitoring-service';
import { SessionId, UserId } from '@domain/value-objects';

interface SendChatMessageCommand {
  content: string;
  userId: string;
  sessionId: string;
  connectionId: string;
}

interface SendChatMessageResult extends BaseResult {
  message?: Message;
}

export interface SendChatMessageUseCase {
  execute(command: SendChatMessageCommand): Promise<SendChatMessageResult>;
}

export class SendChatMessageUseCaseImpl
  extends BaseUseCase<SendChatMessageCommand, SendChatMessageResult>
  implements SendChatMessageUseCase
{
  constructor(
    private readonly chatService: ChatService,
    logger: Logger,
    performanceMonitor: PerformanceMonitoringService
  ) {
    super(logger, performanceMonitor);
  }

  async execute(
    command: SendChatMessageCommand
  ): Promise<SendChatMessageResult> {
    try {
      this.logger.info('Sending chat message', {
        userId: command.userId,
        sessionId: command.sessionId,
        connectionId: command.connectionId,
        contentLength: command.content.length,
      });

      // Validate input
      if (!command.content || command.content.trim().length === 0) {
        throw new MessageValidationException(
          'content',
          command.content,
          'Message content cannot be empty'
        );
      }

      if (command.content.length > 1000) {
        throw new MessageValidationException(
          'content',
          command.content,
          'Message content cannot exceed 1000 characters'
        );
      }

      // Create domain objects
      const userId = UserId.create(command.userId);
      const sessionId = SessionId.create(command.sessionId);

      // Process the message using the chat service
      const result = await this.chatService.processMessage({
        content: command.content,
        userId,
        sessionId,
      });

      this.logger.info('Chat message processed successfully', {
        inputMessageId: result.inputMessage.getId().getValue(),
        outputMessageId: result.outputMessage.getId().getValue(),
        userId: command.userId,
        sessionId: command.sessionId,
      });

      return {
        success: true,
        message: result.outputMessage,
      };
    } catch (error) {
      return this.handleError(error, {
        userId: command.userId,
        sessionId: command.sessionId,
        connectionId: command.connectionId,
        contentLength: command.content?.length,
      });
    }
  }
}
