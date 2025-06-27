import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

import { container } from '../config/container';

import { authenticationService } from './authentication-service';
import { circuitBreakerService } from './circuit-breaker-service';

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

export class ChatService {
  async storeAndEchoMessage({
    connectionId,
    message,
    sessionId,
  }: {
    connectionId: string;
    message: string;
    sessionId?: string;
  }): Promise<{ message: string; sessionId: string }> {
    // Start performance monitoring for chat message processing
    const performanceMonitor = container
      .getPerformanceMonitoringService()
      .startMonitoring('chat_message_processing', {
        connectionId,
        messageLength: message?.length,
        hasSessionId: !!sessionId,
        sessionId,
        operation: 'chat_message_processing',
        service: 'chat',
      });

    try {
      if (typeof message !== 'string')
        throw new Error('Message must be a string');

      const user =
        await authenticationService.getUserFromConnection(connectionId);
      if (!user) throw new Error('User not found for authenticated connection');

      const now = new Date();
      const currentSessionId =
        sessionId ||
        `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const userMessage = {
        message,
        sessionId: currentSessionId,
        timestamp: now.toISOString(),
      };

      // Use circuit breaker for DynamoDB user message storage
      await circuitBreakerService.execute(
        'dynamodb',
        'storeUserMessage',
        async () => {
          return await ddbDocClient.send(
            new PutCommand({
              TableName: process.env.WEBSOCKET_MESSAGES_TABLE,
              Item: {
                ...userMessage,
                ttl: Math.floor(now.getTime() / 1000) + 24 * 60 * 60,
                type: 'user',
                connectionId,
                userId: user.userId,
              },
            })
          );
        },
        async () => {
          // Fallback behavior when DynamoDB is unavailable
          throw new Error('Database temporarily unavailable');
        },
        {
          failureThreshold: 3, // 3 fallos antes de abrir el circuito
          recoveryTimeout: 20000, // 20 segundos de espera
          expectedResponseTime: 500, // 500ms de tiempo de respuesta esperado
          monitoringWindow: 60000, // Ventana de monitoreo de 1 minuto
          minimumRequestCount: 5, // Mínimo 5 requests antes de abrir el circuito
        }
      );

      // Echo the message back as bot
      const botMessage = {
        message,
        sessionId: currentSessionId,
        timestamp: new Date().toISOString(),
      };

      // Use circuit breaker for DynamoDB bot message storage
      await circuitBreakerService.execute(
        'dynamodb',
        'storeBotMessage',
        async () => {
          return await ddbDocClient.send(
            new PutCommand({
              TableName: process.env.WEBSOCKET_MESSAGES_TABLE,
              Item: {
                ...botMessage,
                ttl: Math.floor(now.getTime() / 1000) + 24 * 60 * 60,
                type: 'bot',
                connectionId,
                userId: user.userId,
              },
            })
          );
        },
        async () => {
          // Fallback behavior when DynamoDB is unavailable
          throw new Error('Database temporarily unavailable');
        },
        {
          failureThreshold: 3, // 3 fallos antes de abrir el circuito
          recoveryTimeout: 20000, // 20 segundos de espera
          expectedResponseTime: 500, // 500ms de tiempo de respuesta esperado
          monitoringWindow: 60000, // Ventana de monitoreo de 1 minuto
          minimumRequestCount: 5, // Mínimo 5 requests antes de abrir el circuito
        }
      );

      performanceMonitor.complete(true, {
        userId: user.userId,
        sessionId: currentSessionId,
        messageLength: message.length,
        messageType: 'user_and_bot',
      });

      return { message, sessionId: currentSessionId };
    } catch (error) {
      performanceMonitor.complete(false, {
        error: error instanceof Error ? error.message : String(error),
        connectionId,
        messageLength: message?.length,
        sessionId,
      });
      throw error;
    }
  }
}

export const chatService = new ChatService();
