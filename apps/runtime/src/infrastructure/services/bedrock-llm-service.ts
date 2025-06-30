import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput,
} from '@aws-sdk/client-bedrock-runtime';
import { logger } from '@awslambdahackathon/utils/lambda';
import { LLMService, InvokeLLMCommand, InvokeLLMResult } from '@domain/services/llm-service';

export class BedrockLLMService implements LLMService {
  private readonly bedrockRuntimeClient: BedrockRuntimeClient;
  private readonly modelId: string;

  constructor(region: string, modelId: string) {
    this.bedrockRuntimeClient = new BedrockRuntimeClient({ region });
    this.modelId = modelId;
  }

  async invokeModel(command: InvokeLLMCommand): Promise<InvokeLLMResult> {
    logger.info('Invoking Bedrock LLM', {
      userId: command.userId.getValue(),
      sessionId: command.sessionId.getValue(),
      modelId: this.modelId,
      promptLength: command.prompt.length,
    });

    try {
      const input: InvokeModelCommandInput = {
        body: JSON.stringify({
          prompt: command.prompt,
          max_tokens_to_sample: 200,
          temperature: 0.7,
          top_p: 0.9,
        }),
        contentType: 'application/json',
        accept: 'application/json',
        modelId: this.modelId,
      };

      const invokeCommand = new InvokeModelCommand(input);
      const response = await this.bedrockRuntimeClient.send(invokeCommand);

      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const llmResponse = responseBody.completion;

      logger.info('Bedrock LLM invocation successful', {
        userId: command.userId.getValue(),
        sessionId: command.sessionId.getValue(),
        llmResponseLength: llmResponse.length,
      });

      return {
        response: llmResponse,
      };
    } catch (error) {
      logger.error('Error invoking Bedrock LLM', {
        userId: command.userId.getValue(),
        sessionId: command.sessionId.getValue(),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
