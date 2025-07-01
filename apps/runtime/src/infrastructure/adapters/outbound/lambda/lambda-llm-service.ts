import { logger } from '@awslambdahackathon/utils/lambda';
import {
  LLMModel,
  LLMRequest,
  LLMResponse,
  LLMService,
} from '@domain/services/llm-service';

import {
  LambdaInvokerAdapter,
  LambdaInvokerConfig,
} from './lambda-invoker-adapter';

export class LambdaLLMService implements LLMService {
  private readonly invoker: LambdaInvokerAdapter;

  constructor(config: LambdaInvokerConfig) {
    this.invoker = new LambdaInvokerAdapter(config);
  }

  async generateResponse(request: LLMRequest): Promise<LLMResponse> {
    logger.info('Generating response via Lambda LLM service', {
      messageId: request.messageId,
      userId: request.userId,
      sessionId: request.sessionId,
      model: request.model,
    });

    try {
      return await this.invoker.invokeLLMService(request);
    } catch (error) {
      logger.error('Failed to generate response via Lambda LLM service', {
        messageId: request.messageId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        messageId: request.messageId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async validateRequest(
    request: LLMRequest
  ): Promise<{ success: boolean; error?: string }> {
    // Basic validation
    if (!request.messageId) {
      return { success: false, error: 'messageId is required' };
    }

    if (!request.userId) {
      return { success: false, error: 'userId is required' };
    }

    if (!request.sessionId) {
      return { success: false, error: 'sessionId is required' };
    }

    if (!request.message || request.message.trim().length === 0) {
      return {
        success: false,
        error: 'message is required and cannot be empty',
      };
    }

    if (request.message.length > 10000) {
      return {
        success: false,
        error: 'message is too long (max 10000 characters)',
      };
    }

    if (
      request.maxTokens &&
      (request.maxTokens < 1 || request.maxTokens > 4096)
    ) {
      return { success: false, error: 'maxTokens must be between 1 and 4096' };
    }

    if (
      request.temperature &&
      (request.temperature < 0 || request.temperature > 1)
    ) {
      return { success: false, error: 'temperature must be between 0 and 1' };
    }

    const supportedModels = this.getSupportedModels();
    if (request.model && !supportedModels.includes(request.model)) {
      return {
        success: false,
        error: `unsupported model: ${request.model}. Supported models: ${supportedModels.join(', ')}`,
      };
    }

    return { success: true };
  }

  async isAvailable(): Promise<boolean> {
    try {
      return await this.invoker.healthCheck();
    } catch (error) {
      logger.warn('LLM service availability check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  getSupportedModels(): LLMModel[] {
    return [
      'nova-micro',
      'nova-lite',
      'nova-pro',
      'claude-3-haiku',
      'claude-3-sonnet',
      'claude-3-opus',
    ];
  }
}
