import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export interface LambdaResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

export interface LambdaEvent {
  requestContext: {
    requestId: string;
    connectionId?: string;
  };
  body?: string | null;
  headers?: Record<string, string>;
}

export interface LambdaResponseAdapter {
  createResponse(response: LambdaResponse): APIGatewayProxyResult;
  parseEvent(event: APIGatewayProxyEvent): LambdaEvent;
}

export class AwsLambdaResponseAdapter implements LambdaResponseAdapter {
  createResponse(response: LambdaResponse): APIGatewayProxyResult {
    return {
      statusCode: response.statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers':
          'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        ...response.headers,
      },
      body: response.body,
    };
  }

  parseEvent(event: APIGatewayProxyEvent): LambdaEvent {
    return {
      requestContext: {
        requestId: event.requestContext.requestId,
        connectionId: event.requestContext.connectionId,
      },
      body: event.body,
      headers: this.parseHeaders(event.headers),
    };
  }

  private parseHeaders(
    headers?: Record<string, string | undefined>
  ): Record<string, string> {
    if (!headers) {
      return {};
    }

    const parsedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (value !== undefined) {
        parsedHeaders[key] = value;
      }
    }
    return parsedHeaders;
  }
}
