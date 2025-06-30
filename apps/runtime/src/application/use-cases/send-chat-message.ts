import { logger } from '@awslambdahackathon/utils/lambda';
import type { ChatService } from '@domain/services/chat-service';
import { SessionId, UserId } from '@domain/value-objects';

interface SendChatMessageInput {
  connectionId: string;
  message: string;
  sessionId?: string;
  userId: string; // Add userId as required parameter
}

interface SendChatMessageResult {
  success: boolean;
  message?: string;
  sessionId?: string;
  error?: string;
}

export async function sendChatMessage(
  chatService: ChatService,
  input: SendChatMessageInput
): Promise<SendChatMessageResult> {
  try {
    logger.info('Processing chat message', {
      connectionId: input.connectionId,
      messageLength: input.message.length,
      sessionId: input.sessionId,
    });

    const userId = UserId.create(input.userId);
    const sessionId = input.sessionId
      ? SessionId.create(input.sessionId)
      : SessionId.generate();

    // Validate message first
    const message = {
      content: input.message,
      userId,
      sessionId,
      messageType: 'user' as const,
    };

    const result = await chatService.processMessage(message);

    return {
      success: true,
      message: result.message.getContent(),
      sessionId: result.sessionId.getValue(),
    };
  } catch (error) {
    logger.error('Failed to send chat message', {
      error: error instanceof Error ? error.message : 'Unknown error',
      connectionId: input.connectionId,
    });

    return {
      success: false,
      error: 'Failed to process message',
    };
  }
}
