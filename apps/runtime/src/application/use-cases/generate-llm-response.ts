import { Logger } from '@awslambdahackathon/types';
import { LLMRequest, LLMService } from '@domain/services/llm-service';
import { PerformanceMonitoringService } from '@domain/services/performance-monitoring-service';

import { BaseUseCase } from './base-use-case';

export interface GenerateLLMResponseCommand {
  request: LLMRequest;
  correlationId: string;
}

export interface GenerateLLMResponseResult {
  success: boolean;
  response?: string;
  error?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export class GenerateLLMResponseUseCase extends BaseUseCase<
  GenerateLLMResponseCommand,
  GenerateLLMResponseResult
> {
  constructor(
    logger: Logger,
    performanceMonitoringService: PerformanceMonitoringService,
    private readonly llmService: LLMService
  ) {
    super(logger, performanceMonitoringService);
  }

  async execute(
    command: GenerateLLMResponseCommand
  ): Promise<GenerateLLMResponseResult> {
    const startTime = Date.now();

    try {
      this.logger.info('Starting LLM response generation', {
        correlationId: command.correlationId,
        messageId: command.request.messageId,
        model: command.request.model,
        messageLength: command.request.message.length,
        maxTokens: command.request.maxTokens,
        temperature: command.request.temperature,
      });

      // Check if LLM service is available
      const isAvailable = await this.llmService.isAvailable();
      if (!isAvailable) {
        this.logger.error('LLM service is not available', {
          correlationId: command.correlationId,
        });
        return {
          success: false,
          error: 'LLM service is temporarily unavailable',
        };
      }

      // Generate response using LLM service
      const llmResponse = await this.llmService.generateResponse(
        command.request
      );

      const duration = Date.now() - startTime;

      if (!llmResponse.success) {
        this.logger.error('LLM response generation failed', {
          correlationId: command.correlationId,
          error: llmResponse.error,
          duration,
        });
        return {
          success: false,
          error: llmResponse.error || 'Failed to generate LLM response',
        };
      }

      this.logger.info('LLM response generated successfully', {
        correlationId: command.correlationId,
        messageId: command.request.messageId,
        responseLength: llmResponse.response?.length || 0,
        inputTokens: llmResponse.usage?.inputTokens,
        outputTokens: llmResponse.usage?.outputTokens,
        totalTokens: llmResponse.usage?.totalTokens,
        duration,
      });

      // Log performance metrics
      this.performanceMonitoringService.recordBusinessMetric(
        'llm_response_generation_duration',
        duration,
        'Milliseconds',
        {
          messageId: command.request.messageId,
          userId: command.request.userId,
          sessionId: command.request.sessionId,
          model: command.request.model || 'claude-3-haiku',
        },
        [
          { Name: 'Model', Value: command.request.model || 'claude-3-haiku' },
          {
            Name: 'MessageLength',
            Value: command.request.message.length.toString(),
          },
          {
            Name: 'ResponseLength',
            Value: (llmResponse.response?.length || 0).toString(),
          },
          {
            Name: 'InputTokens',
            Value: (llmResponse.usage?.inputTokens || 0).toString(),
          },
          {
            Name: 'OutputTokens',
            Value: (llmResponse.usage?.outputTokens || 0).toString(),
          },
        ]
      );

      return {
        success: true,
        response: llmResponse.response,
        usage: llmResponse.usage,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error('Error during LLM response generation', {
        correlationId: command.correlationId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        duration,
      });

      return {
        success: false,
        error: 'Internal error during LLM response generation',
      };
    }
  }
}
