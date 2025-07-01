import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput,
  InvokeModelCommandOutput,
} from '@aws-sdk/client-bedrock-runtime';
import { logger } from '@awslambdahackathon/utils/lambda';
import {
  LLMModel,
  LLMRequest,
  LLMResponse,
  LLMService,
  LLMUsage,
} from '@domain/services/llm-service';

export interface BedrockConfig {
  region: string;
  defaultModel: LLMModel;
  timeout: number;
  maxRetries: number;
}

export interface ClaudeRequest {
  anthropic_version: string;
  max_tokens: number;
  temperature: number;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

export interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  stop_sequence: null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface NovaRequest {
  messages: Array<{
    role: 'user' | 'assistant';
    content: Array<{
      type: 'text';
      text: string;
    }>;
  }>;
  max_tokens: number;
  temperature: number;
  system?: string;
}

export interface NovaResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  stop_sequence: null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class BedrockLLMAdapter implements LLMService {
  private readonly client: BedrockRuntimeClient;
  private readonly config: BedrockConfig;

  // Map our models to Bedrock model IDs and inference profiles
  private readonly modelMap = {
    'nova-micro': 'us.amazon.nova-micro-v1:0', // Use inference profile for Nova models
    'nova-lite': 'us.amazon.nova-lite-v1:0', // Use inference profile for Nova models
    'nova-pro': 'us.amazon.nova-pro-v1:0', // Use inference profile for Nova models
    'claude-3-haiku': 'anthropic.claude-3-haiku-20240307-v1:0',
    'claude-3-sonnet': 'anthropic.claude-3-sonnet-20240229-v1:0',
    'claude-3-opus': 'anthropic.claude-3-opus-20240229-v1:0',
  } as const;

  constructor(config: BedrockConfig) {
    this.config = config;
    this.client = new BedrockRuntimeClient({
      region: config.region,
      maxAttempts: config.maxRetries,
    });
  }

  async generateResponse(request: LLMRequest): Promise<LLMResponse> {
    try {
      logger.info('Starting Bedrock LLM request', {
        messageId: request.messageId,
        model: request.model,
        messageLength: request.message.length,
        maxTokens: request.maxTokens,
        temperature: request.temperature,
      });

      const model = request.model || this.config.defaultModel;
      const modelId = this.modelMap[model];
      const isNova = this.isNovaModel(model);

      let requestBody: string;

      if (isNova) {
        // Prepare request for Nova models
        const novaRequest: NovaRequest = {
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: this.buildPrompt(request),
                },
              ],
            },
          ],
          max_tokens: request.maxTokens || 1000,
          temperature: request.temperature || 0.7,
        };
        requestBody = JSON.stringify(novaRequest);
      } else {
        // Prepare request for Claude models
        const claudeRequest: ClaudeRequest = {
          anthropic_version: '2023-06-01',
          max_tokens: request.maxTokens || 1000,
          temperature: request.temperature || 0.7,
          messages: [
            {
              role: 'user',
              content: this.buildPrompt(request),
            },
          ],
        };
        requestBody = JSON.stringify(claudeRequest);
      }

      const input: InvokeModelCommandInput = {
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: requestBody,
      };

      const command = new InvokeModelCommand(input);
      const response: InvokeModelCommandOutput =
        await this.client.send(command);

      if (!response.body) {
        logger.error('No response body from Bedrock', {
          messageId: request.messageId,
        });
        return {
          success: false,
          messageId: request.messageId,
          error: 'No response received from Bedrock',
        };
      }

      // Parse the response
      const responseBody = JSON.parse(
        new TextDecoder().decode(response.body)
      ) as ClaudeResponse;

      const generatedText = responseBody.content
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('');

      const usage: LLMUsage = {
        inputTokens: responseBody.usage.input_tokens,
        outputTokens: responseBody.usage.output_tokens,
        totalTokens:
          responseBody.usage.input_tokens + responseBody.usage.output_tokens,
      };

      logger.info('Bedrock LLM request completed successfully', {
        messageId: request.messageId,
        model: request.model,
        responseLength: generatedText.length,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
      });

      return {
        success: true,
        messageId: request.messageId,
        response: generatedText,
        usage,
      };
    } catch (error) {
      logger.error('Bedrock LLM request failed', {
        messageId: request.messageId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        messageId: request.messageId,
        error:
          error instanceof Error
            ? `Bedrock error: ${error.message}`
            : 'Unknown Bedrock error',
      };
    }
  }

  async validateRequest(
    request: LLMRequest
  ): Promise<{ success: boolean; error?: string }> {
    // Basic validation
    if (!request.message || request.message.trim().length === 0) {
      return { success: false, error: 'Message cannot be empty' };
    }

    if (request.message.length > 200000) {
      return {
        success: false,
        error: 'Message too long (max 200k characters)',
      };
    }

    if (request.model && !this.modelMap[request.model]) {
      return { success: false, error: `Unsupported model: ${request.model}` };
    }

    if (
      request.maxTokens &&
      (request.maxTokens < 1 || request.maxTokens > 4096)
    ) {
      return {
        success: false,
        error: 'maxTokens must be between 1 and 4096',
      };
    }

    if (
      request.temperature &&
      (request.temperature < 0 || request.temperature > 1)
    ) {
      return {
        success: false,
        error: 'temperature must be between 0 and 1',
      };
    }

    return { success: true };
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Simple health check - try to make a minimal request
      const testRequest: LLMRequest = {
        messageId: 'health-check',
        userId: 'system',
        sessionId: 'system',
        message: 'Say "OK" if you can receive this message.',
        model: this.config.defaultModel,
        maxTokens: 10,
        temperature: 0,
      };

      const result = await this.generateResponse(testRequest);
      return result.success;
    } catch (error) {
      logger.warn('Bedrock health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  getSupportedModels(): LLMModel[] {
    return Object.keys(this.modelMap) as LLMModel[];
  }

  private buildPrompt(request: LLMRequest): string {
    let prompt = request.message;

    // Add context if provided
    if (request.context) {
      prompt = `Context: ${request.context}\n\nUser: ${request.message}`;
    }

    return prompt;
  }

  private isNovaModel(model: LLMModel): boolean {
    return model.startsWith('nova-');
  }
}
