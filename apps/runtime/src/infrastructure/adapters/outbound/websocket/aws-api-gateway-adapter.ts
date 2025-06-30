import crypto from 'crypto';

import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { logger } from '@awslambdahackathon/utils/lambda';
import { container } from '@config/container';
import {
  CommunicationService,
  WebSocketMessage,
} from '@domain/services/communication-service';
import { ConnectionId } from '@domain/value-objects';
import type { APIGatewayProxyEvent } from 'aws-lambda';

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
    message: WebSocketMessage
  ): Promise<void> {
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

      // Create properly structured WebSocket message
      const webSocketMessage = {
        type: message.type,
        id: crypto.randomUUID(),
        timestamp: message.timestamp.toISOString(),
        data: message.data,
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
    } catch (error) {
      errorType = 'WEBSOCKET_SEND_ERROR';
      logger.error('Failed to send message', {
        connectionId: connectionId.getValue(),
        messageType: message.type,
        error: error instanceof Error ? error.message : String(error),
        correlationId: this.generateCorrelationId(),
      });
      throw error; // Re-throw since interface expects Promise<void>
    } finally {
      const duration = Date.now() - startTime;
      await container
        .getMetricsService()
        .recordWebSocketMetrics('message_sent', success, duration, errorType);
    }
  }

  async sendToUser(userId: string, message: WebSocketMessage): Promise<void> {
    logger.warn(
      'sendToUser not implemented - requires user-to-connection mapping',
      {
        userId,
        messageType: message.type,
      }
    );
    // TODO: Implement user-to-connection mapping to send messages to specific users
  }

  async sendToGroup(groupId: string, message: WebSocketMessage): Promise<void> {
    logger.warn(
      'sendToGroup not implemented - requires group-to-connections mapping',
      {
        groupId,
        messageType: message.type,
      }
    );
    // TODO: Implement group-to-connections mapping to send messages to groups
  }

  async broadcast(message: WebSocketMessage): Promise<void> {
    logger.warn('broadcast not implemented - requires connection registry', {
      messageType: message.type,
    });
    // TODO: Implement broadcast to all active connections
  }

  async disconnect(connectionId: ConnectionId): Promise<void> {
    try {
      logger.info('Disconnecting WebSocket connection', {
        connectionId: connectionId.getValue(),
        correlationId: this.generateCorrelationId(),
      });

      const client = this.getClient();

      // Send close message to connection
      const closeMessage = {
        type: 'disconnect',
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        data: {
          reason: 'Server initiated disconnect',
        },
      };

      try {
        await client.send(
          new PostToConnectionCommand({
            ConnectionId: connectionId.getValue(),
            Data: Buffer.from(JSON.stringify(closeMessage)),
          })
        );
      } catch (error) {
        // Connection might already be closed, log but don't throw
        logger.debug(
          'Could not send disconnect message, connection may already be closed',
          {
            connectionId: connectionId.getValue(),
            error: error instanceof Error ? error.message : String(error),
          }
        );
      }

      logger.info('WebSocket connection disconnect completed', {
        connectionId: connectionId.getValue(),
        correlationId: this.generateCorrelationId(),
      });
    } catch (error) {
      logger.error('Failed to disconnect WebSocket connection', {
        connectionId: connectionId.getValue(),
        error: error instanceof Error ? error.message : String(error),
        correlationId: this.generateCorrelationId(),
      });
      throw error;
    }
  }

  // Helper methods for backward compatibility
  async sendAuthenticationResponse(
    connectionId: ConnectionId,
    response: {
      success: boolean;
      user?: { id: string; username: string; groups: string[] };
      error?: string;
      sessionId?: string;
    }
  ): Promise<void> {
    const message: WebSocketMessage = {
      type: 'auth_response',
      timestamp: new Date(),
      data: response,
    };
    await this.sendMessage(connectionId, message);
  }

  async sendChatMessageResponse(
    connectionId: ConnectionId,
    response: {
      messageId: string;
      content: string;
      userId: string;
      username: string;
      timestamp: Date;
      sessionId: string;
      isEcho: boolean;
    }
  ): Promise<void> {
    const message: WebSocketMessage = {
      type: 'chat_message',
      timestamp: new Date(),
      data: response,
    };
    await this.sendMessage(connectionId, message);
  }

  private generateCorrelationId(): string {
    return `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
