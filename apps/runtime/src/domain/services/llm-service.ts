import { Message } from '@domain/entities';
import { SessionId, UserId } from '@domain/value-objects';

export interface InvokeLLMCommand {
  prompt: string;
  userId: UserId;
  sessionId: SessionId;
  previousMessages?: Message[];
}

export interface InvokeLLMResult {
  response: string;
}

export interface LLMService {
  invokeModel(command: InvokeLLMCommand): Promise<InvokeLLMResult>;
}
