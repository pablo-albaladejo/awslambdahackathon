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

// Legacy WebSocket message interface for backward compatibility (no longer used)

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

      // Create properly structured WebSocket message according to schema
      const webSocketMessage = {
        type: message.type,
        id: crypto.randomUUID(),
        timestamp: message.timestamp?.toISOString() || new Date().toISOString(),
        data: this.createDataForMessageType(message),
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

  private createDataForMessageType(message: CommunicationMessage): unknown {
    switch (message.type) {
      case 'error':
        return {
          code: message.metadata?.errorCode || 'UNKNOWN_ERROR',
          message: message.content,
          details: message.metadata?.details,
          timestamp:
            message.timestamp?.toISOString() || new Date().toISOString(),
        };
      case 'system':
        return {
          action: message.metadata?.notificationType || 'system_message',
          data: {
            message: message.content,
            timestamp:
              message.timestamp?.toISOString() || new Date().toISOString(),
            ...message.metadata,
          },
        };
      case 'ping':
        return {
          timestamp:
            message.timestamp?.toISOString() || new Date().toISOString(),
        };
      default:
        // For other message types, return the content and metadata as-is
        return {
          content: message.content,
          ...message.metadata,
        };
    }
  }

  async sendAuthenticationResponse(
    connectionId: ConnectionId,
    response: AuthenticationResponse
  ): Promise<boolean> {
    const startTime = Date.now();
    let success = false;
    let errorType: string | undefined;

    try {
      logger.debug('Sending authentication response', {
        connectionId: connectionId.getValue(),
        success: response.success,
        userId: response.user?.id,
        correlationId: this.generateCorrelationId(),
      });

      const client = this.getClient();

      // Create properly structured WebSocket message according to schema
      const webSocketMessage = {
        type: 'auth_response',
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        data: {
          success: response.success,
          ...(response.user && {
            userId: response.user.id,
            user: response.user,
          }),
          ...(response.error && { error: response.error }),
          ...(response.sessionId && { sessionId: response.sessionId }),
        },
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
            'API Gateway Management API unavailable, auth response not sent',
            {
              connectionId: connectionId.getValue(),
              success: response.success,
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
      logger.info('Authentication response sent successfully', {
        connectionId: connectionId.getValue(),
        success: response.success,
        userId: response.user?.id,
        correlationId: this.generateCorrelationId(),
      });

      return true;
    } catch (error) {
      errorType = 'WEBSOCKET_AUTH_RESPONSE_ERROR';
      logger.error('Failed to send authentication response', {
        connectionId: connectionId.getValue(),
        success: response.success,
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

  async sendChatMessageResponse(
    connectionId: ConnectionId,
    response: ChatMessageResponse
  ): Promise<boolean> {
    const startTime = Date.now();
    let success = false;
    let errorType: string | undefined;

    try {
      logger.debug('Sending chat message response', {
        connectionId: connectionId.getValue(),
        sessionId: response.sessionId,
        messageLength: response.content.length,
        isEcho: response.isEcho,
        correlationId: this.generateCorrelationId(),
      });

      const client = this.getClient();

      // Create properly structured WebSocket message according to schema
      const webSocketMessage = {
        type: 'message_response',
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        data: {
          messageId: response.messageId,
          content: response.content,
          userId: response.userId,
          username: response.username,
          timestamp: response.timestamp.toISOString(),
          sessionId: response.sessionId,
          isEcho: response.isEcho,
        },
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
            'API Gateway Management API unavailable, chat response not sent',
            {
              connectionId: connectionId.getValue(),
              sessionId: response.sessionId,
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
      logger.info('Chat message response sent successfully', {
        connectionId: connectionId.getValue(),
        sessionId: response.sessionId,
        messageLength: response.content.length,
        isEcho: response.isEcho,
        correlationId: this.generateCorrelationId(),
      });

      return true;
    } catch (error) {
      errorType = 'WEBSOCKET_CHAT_RESPONSE_ERROR';
      logger.error('Failed to send chat message response', {
        connectionId: connectionId.getValue(),
        sessionId: response.sessionId,
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

  async sendSystemNotification(
    connectionId: ConnectionId,
    notification: SystemNotification
  ): Promise<boolean> {
    const startTime = Date.now();
    let success = false;
    let errorType: string | undefined;

    try {
      logger.debug('Sending system notification', {
        connectionId: connectionId.getValue(),
        notificationType: notification.type,
        correlationId: this.generateCorrelationId(),
      });

      const client = this.getClient();

      // Create properly structured WebSocket message according to schema
      const webSocketMessage = {
        type: 'system',
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        data: {
          action: notification.type,
          data: {
            message: notification.message,
            notificationType: notification.type,
            timestamp: notification.timestamp.toISOString(),
          },
        },
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
            'API Gateway Management API unavailable, system notification not sent',
            {
              connectionId: connectionId.getValue(),
              notificationType: notification.type,
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
      logger.info('System notification sent successfully', {
        connectionId: connectionId.getValue(),
        notificationType: notification.type,
        correlationId: this.generateCorrelationId(),
      });

      return true;
    } catch (error) {
      errorType = 'WEBSOCKET_SYSTEM_NOTIFICATION_ERROR';
      logger.error('Failed to send system notification', {
        connectionId: connectionId.getValue(),
        notificationType: notification.type,
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
