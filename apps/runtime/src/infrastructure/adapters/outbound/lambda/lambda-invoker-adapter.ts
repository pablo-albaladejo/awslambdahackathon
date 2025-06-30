import {
  InvokeCommand,
  InvokeCommandInput,
  LambdaClient,
} from '@aws-sdk/client-lambda';
import { logger } from '@awslambdahackathon/utils/lambda';
import { LLMRequest, LLMResponse } from '@domain/services/llm-service';

export interface LambdaInvokerConfig {
  region: string;
  llmFunctionName: string;
  timeout: number;
  maxRetries: number;
}

export class LambdaInvokerAdapter {
  private readonly client: LambdaClient;
  private readonly config: LambdaInvokerConfig;

  constructor(config: LambdaInvokerConfig) {
    this.config = config;
    this.client = new LambdaClient({
      region: config.region,
      maxAttempts: config.maxRetries,
    });
  }

  async invokeLLMService(request: LLMRequest): Promise<LLMResponse> {
    try {
      logger.info('Invoking LLM Lambda service', {
        functionName: this.config.llmFunctionName,
        messageId: request.messageId,
        userId: request.userId,
        sessionId: request.sessionId,
        messageLength: request.message.length,
      });

      const payload = JSON.stringify({
        body: JSON.stringify(request),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const input: InvokeCommandInput = {
        FunctionName: this.config.llmFunctionName,
        InvocationType: 'RequestResponse',
        Payload: new TextEncoder().encode(payload),
      };

      const command = new InvokeCommand(input);
      const response = await this.client.send(command);

      if (response.FunctionError) {
        logger.error('LLM Lambda function error', {
          messageId: request.messageId,
          functionError: response.FunctionError,
          logResult: response.LogResult
            ? Buffer.from(response.LogResult, 'base64').toString('utf-8')
            : undefined,
        });

        return {
          success: false,
          messageId: request.messageId,
          error: `Lambda function error: ${response.FunctionError}`,
        };
      }

      if (!response.Payload) {
        logger.error('No payload returned from LLM Lambda', {
          messageId: request.messageId,
        });

        return {
          success: false,
          messageId: request.messageId,
          error: 'No response payload from LLM service',
        };
      }

      // Parse the response
      const responsePayload = JSON.parse(
        new TextDecoder().decode(response.Payload)
      );

      if (responsePayload.statusCode !== 200) {
        logger.error('LLM Lambda returned error status', {
          messageId: request.messageId,
          statusCode: responsePayload.statusCode,
          errorBody: responsePayload.body,
        });

        const errorResponse = JSON.parse(responsePayload.body || '{}');
        return {
          success: false,
          messageId: request.messageId,
          error: errorResponse.error || 'LLM service returned error status',
        };
      }

      const llmResponse: LLMResponse = JSON.parse(responsePayload.body);

      logger.info('LLM Lambda invocation completed', {
        messageId: request.messageId,
        success: llmResponse.success,
        responseLength: llmResponse.response?.length || 0,
        inputTokens: llmResponse.usage?.inputTokens,
        outputTokens: llmResponse.usage?.outputTokens,
      });

      return llmResponse;
    } catch (error) {
      logger.error('Failed to invoke LLM Lambda service', {
        messageId: request.messageId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        messageId: request.messageId,
        error:
          error instanceof Error
            ? `Lambda invocation failed: ${error.message}`
            : 'Unknown Lambda invocation error',
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const testRequest: LLMRequest = {
        messageId: 'health-check',
        userId: 'system',
        sessionId: 'system',
        message: 'Health check',
        model: 'nova-micro',
        maxTokens: 10,
        temperature: 0,
      };

      const result = await this.invokeLLMService(testRequest);
      return result.success;
    } catch (error) {
      logger.warn('LLM Lambda health check failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}
