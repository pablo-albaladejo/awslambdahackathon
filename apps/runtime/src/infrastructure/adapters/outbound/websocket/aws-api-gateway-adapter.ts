import crypto from 'crypto';

import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { logger } from '@awslambdahackathon/utils/lambda';
import { container } from '@config/container';
import type { APIGatewayProxyEvent } from 'aws-lambda';

import {
  AuthResponse,
  WebSocketMessage,
  WebSocketMessageService,
} from '@/application/services/websocket-message-service';

export class AwsApiGatewayWebSocketAdapter implements WebSocketMessageService {
  private readonly clients: Map<string, ApiGatewayManagementApiClient>;
  private readonly event: APIGatewayProxyEvent;

  constructor(event: APIGatewayProxyEvent) {
    this.clients = new Map();
    this.event = event;
  }

  private getClient(): ApiGatewayManagementApiClient {
    const domain = this.event.requestContext.domainName;
    const stage = this.event.requestContext.stage;
    const endpoint = `https://${domain}/${stage}`;
    const key = `${domain}/${stage}`;

    if (!this.clients.has(key)) {
      this.clients.set(key, new ApiGatewayManagementApiClient({ endpoint }));
    }

    return this.clients.get(key)!;
  }

  async sendMessage(
    connectionId: string,
    message: WebSocketMessage
  ): Promise<boolean> {
    const startTime = Date.now();
    let success = false;
    let errorType: string | undefined;

    try {
      logger.debug('Sending WebSocket message', {
        connectionId,
        messageType: message.type,
        correlationId: this.generateCorrelationId(),
      });

      const client = this.getClient();

      // Use circuit breaker for API Gateway Management API calls
      await container.getCircuitBreakerService().execute(
        'apigateway-management',
        'postToConnection',
        async () => {
          return await client.send(
            new PostToConnectionCommand({
              ConnectionId: connectionId,
              Data: Buffer.from(JSON.stringify(message)),
            })
          );
        },
        async () => {
          // Fallback behavior when API Gateway is unavailable
          logger.warn(
            'API Gateway Management API unavailable, message not sent',
            {
              connectionId,
              messageType: message.type,
              correlationId: this.generateCorrelationId(),
            }
          );
          throw new Error('WebSocket service temporarily unavailable');
        },
        {
          failureThreshold: 5,
          recoveryTimeout: 15000, // 15 seconds
          expectedResponseTime: 1000, // 1 second
          monitoringWindow: 30000, // 30 seconds
          minimumRequestCount: 3,
        }
      );

      success = true;
      logger.info('Message sent successfully', {
        connectionId,
        messageType: message.type,
        correlationId: this.generateCorrelationId(),
      });

      return true;
    } catch (error) {
      errorType = 'WEBSOCKET_SEND_ERROR';
      logger.error('Failed to send message', {
        connectionId,
        messageType: message.type,
        error: error instanceof Error ? error.message : String(error),
        correlationId: this.generateCorrelationId(),
      });

      return false;
    } finally {
      const duration = Date.now() - startTime;
      await container
        .getMetricsService()
        .recordWebSocketMetrics('message_sent', success, duration, errorType);
    }
  }

  async sendAuthResponse(
    connectionId: string,
    success: boolean,
    data: AuthResponse
  ): Promise<boolean> {
    const message: WebSocketMessage = {
      type: 'auth_response',
      data: {
        success,
        ...data,
      },
    };

    logger.info('Sending authentication response', {
      connectionId,
      success,
      userId: data.userId,
      correlationId: this.generateCorrelationId(),
    });

    return this.sendMessage(connectionId, message);
  }

  async sendChatResponse(
    connectionId: string,
    message: string,
    sessionId: string,
    isEcho: boolean
  ): Promise<boolean> {
    const response: WebSocketMessage = {
      type: 'message_response',
      data: {
        message,
        sessionId,
        messageId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        isEcho,
      },
    };

    logger.info('Sending chat response', {
      connectionId,
      sessionId,
      messageLength: message.length,
      isEcho,
      correlationId: this.generateCorrelationId(),
    });

    return this.sendMessage(connectionId, response);
  }

  async sendErrorMessage(
    connectionId: string,
    errorMessage: string
  ): Promise<boolean> {
    const message: WebSocketMessage = {
      type: 'error',
      error: errorMessage,
      timestamp: new Date().toISOString(),
    };

    logger.info('Sending error message', {
      connectionId,
      errorMessage,
      correlationId: this.generateCorrelationId(),
    });

    return this.sendMessage(connectionId, message);
  }

  async sendSystemMessage(
    connectionId: string,
    text: string
  ): Promise<boolean> {
    const message: WebSocketMessage = {
      type: 'system',
      message: text,
      timestamp: new Date().toISOString(),
    };

    logger.info('Sending system message', {
      connectionId,
      text,
      correlationId: this.generateCorrelationId(),
    });

    return this.sendMessage(connectionId, message);
  }

  cleanup(): void {
    this.clients.clear();
  }

  private generateCorrelationId(): string {
    return `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
