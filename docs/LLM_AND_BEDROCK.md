# LLM and Bedrock Integration

This document provides information about the integration of Large Language Models (LLMs) and AWS Bedrock within this project.

## Overview

This project leverages AWS Bedrock to provide LLM capabilities. Bedrock allows us to access and utilize various LLMs through a unified API.

## Components

*   **Bedrock LLM Adapter**: This component is responsible for interacting with the Bedrock API.
*   **LLM Service**: This service provides an abstraction layer for interacting with the LLM, handling requests and responses.
*   **Use Cases**: Several use cases utilize the LLM service, such as generating responses and processing requests.

## Implementation Details

The integration with AWS Bedrock is handled by the `BedrockLLMAdapter` class. This adapter is responsible for:

1.  **Initializing the Bedrock Client**: The adapter initializes a `BedrockRuntimeClient` using the provided configuration, including the AWS region and retry settings.
2.  **Mapping Models**: The `modelMap` property maps the project's internal LLM model names to the corresponding Bedrock model IDs.
3.  **Generating Responses**: The `generateResponse` method takes an `LLMRequest` and performs the following steps:
    *   Selects the appropriate Bedrock model ID based on the request.
    *   Constructs the request body in JSON format, tailored to the specific model (e.g., Claude or Nova).  The request body includes the prompt, max tokens, and temperature.
    *   Invokes the Bedrock API using the `InvokeModelCommand`.
    *   Parses the response from Bedrock, extracting the generated text and usage metrics (input/output tokens).
    *   Returns an `LLMResponse` containing the generated text, success status, and usage information.
4.  **Validating Requests**: The `validateRequest` method performs basic validation of the incoming `LLMRequest`, ensuring that the message is not empty, the message length is within limits, and the model is supported.
5.  **Health Check**: The `isAvailable` method performs a simple health check by sending a test request to the LLM.
6.  **Supporting Models**: The `getSupportedModels` method returns the list of supported LLM models.

Here's a simplified example of how the `generateResponse` method works:

```typescript
async generateResponse(request: LLMRequest): Promise<LLMResponse> {
  // ... (Initialization and model selection)

  const input: InvokeModelCommandInput = {
    modelId,
    contentType: 'application/json',
    accept: 'application/json',
    body: requestBody,
  };

  const command = new InvokeModelCommand(input);
  const response: InvokeModelCommandOutput =
    await this.client.send(command);

  // ... (Parsing and response handling)
}
```

## Configuration

The `BedrockLLMAdapter` is configured using the `BedrockConfig` interface. This configuration includes:

*   `region`: The AWS region where the Bedrock service is located (e.g., 'us-east-1').
*   `defaultModel`: The default LLM model to use if a model is not specified in the request (e.g., 'claude-3-opus').
*   `timeout`: The timeout in milliseconds for Bedrock API calls.
*   `maxRetries`: The maximum number of retries for Bedrock API calls.

The following LLM models are supported:

*   `nova-micro`
*   `nova-lite`
*   `nova-pro`
*   `claude-3-haiku`
*   `claude-3-sonnet`
*   `claude-3-opus`

The configuration is typically loaded from environment variables or a configuration file.

## Further Reading

*   [AWS Bedrock Documentation](https://docs.aws.amazon.com/bedrock/index.html)
