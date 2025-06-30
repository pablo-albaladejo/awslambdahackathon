import { logger } from '@awslambdahackathon/utils/lambda';
import { LLMRequest, LLMResponse } from '@domain/services/llm-service';
import {
  BedrockConfig,
  BedrockLLMAdapter,
} from '@infrastructure/adapters/outbound/bedrock';
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';

// Initialize Bedrock adapter
const bedrockConfig: BedrockConfig = {
  region: process.env.AWS_REGION || 'us-east-2',
  defaultModel: 'nova-micro',
  timeout: 30000,
  maxRetries: 3,
};

const llmService = new BedrockLLMAdapter(bedrockConfig);

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  const correlationId = `llm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  logger.info('LLM Service Lambda invoked', {
    correlationId,
    requestId: context.awsRequestId,
    functionName: context.functionName,
    hasBody: !!event.body,
  });

  try {
    // Parse request
    if (!event.body) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          error: 'Request body is required',
        }),
      };
    }

    const llmRequest: LLMRequest = JSON.parse(event.body);

    logger.info('Processing LLM request', {
      correlationId,
      messageId: llmRequest.messageId,
      userId: llmRequest.userId,
      sessionId: llmRequest.sessionId,
      model: llmRequest.model || 'claude-3-haiku',
      messageLength: llmRequest.message.length,
    });

    // Validate request
    const validationResult = await llmService.validateRequest(llmRequest);
    if (!validationResult.success) {
      logger.warn('LLM request validation failed', {
        correlationId,
        error: validationResult.error,
      });

      return {
        statusCode: 400,
        body: JSON.stringify({
          success: false,
          messageId: llmRequest.messageId,
          error: validationResult.error,
        }),
      };
    }

    // Generate LLM response
    const llmResult = await llmService.generateResponse(llmRequest);

    logger.info('LLM processing completed', {
      correlationId,
      messageId: llmRequest.messageId,
      success: llmResult.success,
      responseLength: llmResult.response?.length || 0,
      inputTokens: llmResult.usage?.inputTokens,
      outputTokens: llmResult.usage?.outputTokens,
    });

    const response: LLMResponse = {
      success: llmResult.success,
      messageId: llmRequest.messageId,
      response: llmResult.response,
      error: llmResult.error,
      usage: llmResult.usage,
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': correlationId,
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    logger.error('LLM Service Lambda error', {
      correlationId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: 'Internal server error',
      }),
    };
  }
};
