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

export interface LLMRequest {
  messageId: string;
  userId: string;
  sessionId: string;
  message: string;
  context?: string;
  model?: LLMModel;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse {
  success: boolean;
  messageId: string;
  response?: string;
  error?: string;
  usage?: LLMUsage;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export type LLMModel =
  | 'nova-micro'
  | 'nova-lite'
  | 'nova-pro'
  | 'claude-3-haiku'
  | 'claude-3-sonnet'
  | 'claude-3-opus';

export interface LLMService {
  /**
   * Generate response using LLM
   */
  generateResponse(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Validate LLM request
   */
  validateRequest(
    request: LLMRequest
  ): Promise<{ success: boolean; error?: string }>;

  /**
   * Check if LLM service is available
   */
  isAvailable(): Promise<boolean>;

  /**
   * Get supported models
   */
  getSupportedModels(): LLMModel[];
}
