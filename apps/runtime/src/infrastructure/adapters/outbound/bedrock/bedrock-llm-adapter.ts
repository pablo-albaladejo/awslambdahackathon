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

/**
 * Claude request interface according to official AWS Bedrock documentation
 * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages-request-response.html
 */
export interface ClaudeRequest {
  anthropic_version: string; // Must be "bedrock-2023-05-31" for Bedrock
  max_tokens: number; // Required: maximum tokens to generate
  temperature?: number; // Optional: randomness (0-1, default 1)
  top_p?: number; // Optional: nucleus sampling (0-1, default 0.999)
  top_k?: number; // Optional: top-k sampling (0-500, disabled by default)
  system?: string; // Optional: system prompt
  messages: Array<{
    role: 'user' | 'assistant';
    content:
      | Array<{
          type: 'text';
          text: string;
        }>
      | string; // Support both array format and string format (shorthand)
  }>;
  stop_sequences?: string[]; // Optional: custom stop sequences
}

/**
 * Claude response interface according to official AWS Bedrock documentation
 * @see https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-anthropic-claude-messages-request-response.html
 */
export interface ClaudeResponse {
  id: string; // Unique identifier for the response
  type: string; // Always "message"
  role: string; // Always "assistant"
  content: Array<{
    type: string; // "text", "tool_use", or "image"
    text: string; // Generated text content
    // Additional fields for tool use and image responses
    id?: string;
    name?: string;
    input?: any;
    image?: any;
  }>;
  model: string; // Model ID that processed the request
  stop_reason: string; // "end_turn", "max_tokens", or "stop_sequence"
  stop_sequence?: string; // The stop sequence that ended generation (if any)
  usage: {
    input_tokens: number; // Number of input tokens
    output_tokens: number; // Number of output tokens
  };
}

export interface NovaRequest {
  schemaVersion: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: Array<{
      text: string;
    }>;
  }>;
  inferenceConfig: {
    maxTokens: number;
    temperature: number;
    topP: number;
    topK: number;
  };
  system?: Array<{
    text: string;
  }>;
}

export interface NovaResponse {
  output: {
    message: {
      content: Array<{
        text: string;
      }>;
    };
  };
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  stopReason: string;
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
        // Prepare request for Nova models using the correct format from AWS documentation
        const novaRequest: NovaRequest = {
          schemaVersion: 'messages-v1',
          messages: [
            {
              role: 'user',
              content: [
                {
                  text: this.buildPrompt(request),
                },
              ],
            },
          ],
          inferenceConfig: {
            maxTokens: request.maxTokens || 1000,
            temperature: request.temperature || 0.7,
            topP: request.topP || 0.9,
            topK: 20,
          },
        };

        // Add system prompt if provided
        if (request.systemPrompt) {
          novaRequest.system = [
            {
              text: request.systemPrompt,
            },
          ];
        }

        requestBody = JSON.stringify(novaRequest);
      } else {
        // Prepare request for Claude models according to official AWS Bedrock documentation
        const claudeRequest: ClaudeRequest = {
          anthropic_version: 'bedrock-2023-05-31', // Official version for Bedrock
          max_tokens: request.maxTokens || 1000,
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
        };

        // Add optional parameters only if they are provided
        if (request.temperature !== undefined) {
          claudeRequest.temperature = request.temperature;
        }
        if (request.topP !== undefined) {
          claudeRequest.top_p = request.topP;
        }
        if (request.topK !== undefined) {
          claudeRequest.top_k = request.topK;
        }
        if (request.systemPrompt) {
          claudeRequest.system = request.systemPrompt;
        }

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

      // Parse the response based on model type
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      let generatedText: string;
      let usage: LLMUsage;

      if (isNova) {
        // Parse Nova response format
        const novaResponse = responseBody as NovaResponse;

        generatedText = novaResponse.output.message.content
          .map(item => item.text)
          .join('');

        usage = {
          inputTokens: novaResponse.usage.inputTokens,
          outputTokens: novaResponse.usage.outputTokens,
          totalTokens:
            novaResponse.usage.inputTokens + novaResponse.usage.outputTokens,
        };
      } else {
        // Parse Claude response format
        const claudeResponse = responseBody as ClaudeResponse;

        generatedText = claudeResponse.content
          .filter(item => item.type === 'text')
          .map(item => item.text)
          .join('');

        usage = {
          inputTokens: claudeResponse.usage.input_tokens,
          outputTokens: claudeResponse.usage.output_tokens,
          totalTokens:
            claudeResponse.usage.input_tokens +
            claudeResponse.usage.output_tokens,
        };
      }

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

    if (request.topP && (request.topP < 0 || request.topP > 1)) {
      return {
        success: false,
        error: 'topP must be between 0 and 1',
      };
    }

    if (request.topK && (request.topK < 0 || request.topK > 500)) {
      return {
        success: false,
        error: 'topK must be between 0 and 500',
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
