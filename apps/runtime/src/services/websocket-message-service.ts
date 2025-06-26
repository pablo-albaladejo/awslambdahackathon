import crypto from 'crypto';

import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { logger } from '@awslambdahackathon/utils/lambda';
import type { APIGatewayProxyEvent } from 'aws-lambda';

export interface WebSocketMessage {
  type: string;
  message?: string;
  sessionId?: string;
  success?: boolean;
  error?: string;
  isEcho?: boolean;
  [key: string]: unknown;
}

export interface AuthResponse {
  userId?: string;
  username?: string;
  error?: string;
}

export interface ChatResponse {
  message: string;
  sessionId: string;
  isEcho: boolean;
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
    try {
      const client = this.getClient(event);

      await client.send(
        new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: Buffer.from(JSON.stringify(message)),
        })
      );

      logger.info('Message sent successfully', {
        connectionId,
        messageType: message.type,
      });

      return true;
    } catch (error) {
      logger.error('Failed to send message', {
        connectionId,
        messageType: message.type,
        error: error instanceof Error ? error.message : String(error),
      });

      return false;
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

    return this.sendMessage(connectionId, event, message);
  }

  /**
   * Send chat message response
   */
  async sendChatResponse(
    connectionId: string,
    event: APIGatewayProxyEvent,
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

    return this.sendMessage(connectionId, event, response);
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

    return this.sendMessage(connectionId, event, message);
  }

  /**
   * Clean up clients (for memory management)
   */
  cleanup(): void {
    this.clients.clear();
  }
}

// Singleton instance
export const websocketMessageService = new WebSocketMessageService();
