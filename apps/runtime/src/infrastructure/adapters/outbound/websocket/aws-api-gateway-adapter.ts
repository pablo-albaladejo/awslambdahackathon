import crypto from 'crypto';

import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { logger } from '@awslambdahackathon/utils/lambda';
import { container } from '@config/container';
import {
  AuthenticationResponse,
  ChatMessageResponse,
  CommunicationMessage,
  CommunicationService,
  SystemNotification,
} from '@domain/services/communication-service';
import { ConnectionId } from '@domain/value-objects';
import type { APIGatewayProxyEvent } from 'aws-lambda';

// Legacy WebSocket message interface for backward compatibility
interface WebSocketMessage {
  type: string;
  message?: string;
  data?: unknown;
  error?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export class AwsApiGatewayWebSocketAdapter implements CommunicationService {
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
    connectionId: ConnectionId,
    message: CommunicationMessage
  ): Promise<boolean> {
    const startTime = Date.now();
    let success = false;
    let errorType: string | undefined;

    try {
      logger.debug('Sending WebSocket message', {
        connectionId: connectionId.getValue(),
        messageType: message.type,
        correlationId: this.generateCorrelationId(),
      });

      const client = this.getClient();
      const webSocketMessage: WebSocketMessage = {
        type: message.type,
        message: message.content,
        timestamp: message.timestamp?.toISOString() || new Date().toISOString(),
        ...message.metadata,
      };

      // Use circuit breaker for API Gateway Management API calls
      await container.getCircuitBreakerService().execute(
        'apigateway-management',
        'postToConnection',
        async () => {
          return await client.send(
            new PostToConnectionCommand({
              ConnectionId: connectionId.getValue(),
              Data: Buffer.from(JSON.stringify(webSocketMessage)),
            })
          );
        },
        async () => {
          // Fallback behavior when API Gateway is unavailable
          logger.warn(
            'API Gateway Management API unavailable, message not sent',
            {
              connectionId: connectionId.getValue(),
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
        connectionId: connectionId.getValue(),
        messageType: message.type,
        correlationId: this.generateCorrelationId(),
      });

      return true;
    } catch (error) {
      errorType = 'WEBSOCKET_SEND_ERROR';
      logger.error('Failed to send message', {
        connectionId: connectionId.getValue(),
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

  async sendAuthenticationResponse(
    connectionId: ConnectionId,
    response: AuthenticationResponse
  ): Promise<boolean> {
    const message: CommunicationMessage = {
      type: 'auth',
      content: response.success
        ? 'Authentication successful'
        : 'Authentication failed',
      metadata: {
        success: response.success,
        user: response.user,
        error: response.error,
        sessionId: response.sessionId,
      },
    };

    logger.info('Sending authentication response', {
      connectionId: connectionId.getValue(),
      success: response.success,
      userId: response.user?.id,
      correlationId: this.generateCorrelationId(),
    });

    return this.sendMessage(connectionId, message);
  }

  async sendChatMessageResponse(
    connectionId: ConnectionId,
    response: ChatMessageResponse
  ): Promise<boolean> {
    const message: CommunicationMessage = {
      type: 'chat',
      content: response.content,
      metadata: {
        messageId: response.messageId,
        userId: response.userId,
        username: response.username,
        timestamp: response.timestamp.toISOString(),
        sessionId: response.sessionId,
        isEcho: response.isEcho,
      },
    };

    logger.info('Sending chat response', {
      connectionId: connectionId.getValue(),
      sessionId: response.sessionId,
      messageLength: response.content.length,
      isEcho: response.isEcho,
      correlationId: this.generateCorrelationId(),
    });

    return this.sendMessage(connectionId, message);
  }

  async sendSystemNotification(
    connectionId: ConnectionId,
    notification: SystemNotification
  ): Promise<boolean> {
    const message: CommunicationMessage = {
      type: 'system',
      content: notification.message,
      metadata: {
        notificationType: notification.type,
        timestamp: notification.timestamp.toISOString(),
      },
    };

    logger.info('Sending system notification', {
      connectionId: connectionId.getValue(),
      notificationType: notification.type,
      correlationId: this.generateCorrelationId(),
    });

    return this.sendMessage(connectionId, message);
  }

  async disconnect(connectionId: ConnectionId, reason?: string): Promise<void> {
    try {
      if (reason) {
        await this.sendMessage(connectionId, {
          type: 'system',
          content: `Connection closing: ${reason}`,
        });
      }

      // In API Gateway WebSocket, we can't directly close connections
      // The connection will be closed by the client or timeout
      logger.info('Connection disconnect requested', {
        connectionId: connectionId.getValue(),
        reason,
        correlationId: this.generateCorrelationId(),
      });
    } catch (error) {
      logger.error('Failed to send disconnect message', {
        connectionId: connectionId.getValue(),
        error: error instanceof Error ? error.message : String(error),
        correlationId: this.generateCorrelationId(),
      });
    }
  }

  async isConnectionActive(connectionId: ConnectionId): Promise<boolean> {
    try {
      // Try to send a ping message to check if connection is active
      const client = this.getClient();
      await client.send(
        new PostToConnectionCommand({
          ConnectionId: connectionId.getValue(),
          Data: Buffer.from(JSON.stringify({ type: 'ping' })),
        })
      );
      return true;
    } catch (error) {
      logger.debug('Connection not active', {
        connectionId: connectionId.getValue(),
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  cleanup(): void {
    this.clients.clear();
    logger.debug('WebSocket adapter cleanup completed');
  }

  private generateCorrelationId(): string {
    return crypto.randomUUID();
  }
}
