import type { ChatService } from '../../services/chat-service';

export async function sendChatMessage(
  chatService: ChatService,
  {
    connectionId,
    message,
    sessionId,
  }: { connectionId: string; message: string; sessionId?: string }
): Promise<{ message: string; sessionId: string }> {
  return chatService.storeAndEchoMessage({ connectionId, message, sessionId });
}
