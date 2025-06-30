import { LLMRequest } from '@domain/services/llm-service';

import { BaseUseCase } from './base-use-case';

export interface ProcessLLMRequestCommand {
  request: LLMRequest;
  correlationId: string;
}

export interface ProcessLLMRequestResult {
  success: boolean;
  error?: string;
  validatedRequest?: LLMRequest;
}

export class ProcessLLMRequestUseCase extends BaseUseCase<
  ProcessLLMRequestCommand,
  ProcessLLMRequestResult
> {
  async execute(
    command: ProcessLLMRequestCommand
  ): Promise<ProcessLLMRequestResult> {
    try {
      this.logger.info('Processing LLM request validation', {
        correlationId: command.correlationId,
        messageId: command.request.messageId,
        userId: command.request.userId,
        sessionId: command.request.sessionId,
      });

      // Validate required fields
      const validation = this.validateRequest(command.request);
      if (!validation.success) {
        return validation;
      }

      // Sanitize and normalize request
      const validatedRequest = this.sanitizeRequest(command.request);

      this.logger.info('LLM request validation completed', {
        correlationId: command.correlationId,
        messageId: command.request.messageId,
        model: validatedRequest.model,
        maxTokens: validatedRequest.maxTokens,
        temperature: validatedRequest.temperature,
      });

      return {
        success: true,
        validatedRequest,
      };
    } catch (error) {
      this.logger.error('Error processing LLM request', {
        correlationId: command.correlationId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: 'Failed to process LLM request',
      };
    }
  }

  private validateRequest(request: LLMRequest): {
    success: boolean;
    error?: string;
  } {
    // Check required fields
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

    // Validate message length
    if (request.message.length > 10000) {
      return {
        success: false,
        error: 'message is too long (max 10000 characters)',
      };
    }

    // Validate model if provided
    if (
      request.model &&
      !['claude-3-haiku', 'claude-3-sonnet', 'claude-3-opus'].includes(
        request.model
      )
    ) {
      return { success: false, error: 'invalid model specified' };
    }

    // Validate maxTokens if provided
    if (
      request.maxTokens &&
      (request.maxTokens < 1 || request.maxTokens > 4096)
    ) {
      return { success: false, error: 'maxTokens must be between 1 and 4096' };
    }

    // Validate temperature if provided
    if (
      request.temperature &&
      (request.temperature < 0 || request.temperature > 1)
    ) {
      return { success: false, error: 'temperature must be between 0 and 1' };
    }

    return { success: true };
  }

  private sanitizeRequest(request: LLMRequest): LLMRequest {
    return {
      messageId: request.messageId,
      userId: request.userId,
      sessionId: request.sessionId,
      message: request.message.trim(),
      context: request.context?.trim(),
      model: request.model || 'claude-3-haiku',
      maxTokens: request.maxTokens || 1000,
      temperature: request.temperature || 0.7,
    };
  }
}
