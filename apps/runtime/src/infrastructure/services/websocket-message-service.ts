import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { logger } from '@awslambdahackathon/utils/lambda';
import { container } from '@config/container';
import { Message } from '@domain/entities';
import type { APIGatewayProxyEvent } from 'aws-lambda';

export interface WebSocketMessage {
  type: string;
  message?: string;
  sessionId?: string;
  success?: boolean;
  error?: string;
  [key: string]: unknown;
}

export interface AuthResponse {
  userId?: string;
  username?: string;
  error?: string;
}

export class WebSocketMessageService {
  private readonly clients: Map<string, ApiGatewayManagementApiClient>;

  constructor() {
    this.clients = new Map();
  }

  /**
   * Get or create API Gateway Management API client for a connection
   */
  private getClient(
    event: APIGatewayProxyEvent
  ): ApiGatewayManagementApiClient {
    const domain = event.requestContext.domainName;
    const stage = event.requestContext.stage;
    const endpoint = `https://${domain}/${stage}`;
    const key = `${domain}/${stage}`;

    if (!this.clients.has(key)) {
      this.clients.set(key, new ApiGatewayManagementApiClient({ endpoint }));
    }

    return this.clients.get(key)!;
  }

  /**
   * Send message to a specific WebSocket connection
   */
  async sendMessage(
    connectionId: string,
    event: APIGatewayProxyEvent,
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

      const client = this.getClient(event);

      // Use circuit breaker for API Gateway Management API calls
      await container.getCircuitBreakerService().execute(
        'apigateway-management',
        'postToConnection',
        async () => {
          return await client.send(
            new PostToConnectionCommand({
              ConnectionId: connectionId,
              Data: new TextEncoder().encode(JSON.stringify(message)),
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

  /**
   * Send authentication response
   */
  async sendAuthResponse(
    connectionId: string,
    event: APIGatewayProxyEvent,
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

    return this.sendMessage(connectionId, event, message);
  }

  /**
   * Send chat message response
   */
  async sendChatResponse(
    connectionId: string,
    event: APIGatewayProxyEvent,
    userMessage: Message,
    botMessage: Message
  ): Promise<boolean> {
    const userMessageResponse: WebSocketMessage = {
      type: 'message_response',
      data: {
        message: userMessage.getContent(),
        sessionId: userMessage.getSessionId().getValue(),
        messageId: userMessage.getId().getValue(),
        timestamp: userMessage.getCreatedAt().toISOString(),
        isEcho: false, // User message is not an echo
      },
    };

    const botMessageResponse: WebSocketMessage = {
      type: 'message_response',
      data: {
        message: botMessage.getContent(),
        sessionId: botMessage.getSessionId().getValue(),
        messageId: botMessage.getId().getValue(),
        timestamp: botMessage.getCreatedAt().toISOString(),
        isEcho: true, // Bot message is the "echo" or response
      },
    };

    logger.info('Sending chat responses', {
      connectionId,
      userMessageId: userMessage.getId().getValue(),
      botMessageId: botMessage.getId().getValue(),
      correlationId: this.generateCorrelationId(),
    });

    const userMessageSent = await this.sendMessage(
      connectionId,
      event,
      userMessageResponse
    );
    const botMessageSent = await this.sendMessage(
      connectionId,
      event,
      botMessageResponse
    );

    return userMessageSent && botMessageSent;
  }

  /**
   * Send error message
   */
  async sendErrorMessage(
    connectionId: string,
    event: APIGatewayProxyEvent,
    errorMessage: string
  ): Promise<boolean> {
    const message: WebSocketMessage = {
      type: 'error',
      data: {
        message: errorMessage,
        code: 'ERROR',
        timestamp: new Date().toISOString(),
      },
    };

    logger.warn('Sending error message to client', {
      connectionId,
      errorMessage,
      correlationId: this.generateCorrelationId(),
    });

    return this.sendMessage(connectionId, event, message);
  }

  /**
   * Send system message
   */
  async sendSystemMessage(
    connectionId: string,
    event: APIGatewayProxyEvent,
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

    return this.sendMessage(connectionId, event, message);
  }

  /**
   * Clean up clients (for memory management)
   */
  cleanup(): void {
    const clientCount = this.clients.size;
    this.clients.clear();

    logger.info('Cleaned up WebSocket clients', {
      clientCount,
      correlationId: this.generateCorrelationId(),
    });
  }

  /**
   * Generate a correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    return `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
