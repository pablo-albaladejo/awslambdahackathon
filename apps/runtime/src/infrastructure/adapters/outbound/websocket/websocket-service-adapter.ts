import { WebSocketMessageService as InfrastructureWebSocketMessageService } from '@infrastructure/services/websocket-message-service';
import type { APIGatewayProxyEvent } from 'aws-lambda';

import {
  AuthResponse,
  WebSocketMessageService as DomainWebSocketMessageService,
  WebSocketMessage,
} from '@/application/services/websocket-message-service';

export class WebSocketServiceAdapter implements DomainWebSocketMessageService {
  private readonly service: InfrastructureWebSocketMessageService;
  private readonly event: APIGatewayProxyEvent;

  constructor(event: APIGatewayProxyEvent) {
    this.service = new InfrastructureWebSocketMessageService();
    this.event = event;
  }

  async sendMessage(
    connectionId: string,
    message: WebSocketMessage
  ): Promise<boolean> {
    return this.service.sendMessage(connectionId, this.event, message);
  }

  async sendAuthResponse(
    connectionId: string,
    success: boolean,
    data: AuthResponse
  ): Promise<boolean> {
    return this.service.sendAuthResponse(
      connectionId,
      this.event,
      success,
      data
    );
  }

  async sendChatResponse(
    connectionId: string,
    message: string,
    sessionId: string,
    isEcho: boolean
  ): Promise<boolean> {
    return this.service.sendChatResponse(
      connectionId,
      this.event,
      message,
      sessionId,
      isEcho
    );
  }

  async sendErrorMessage(
    connectionId: string,
    errorMessage: string
  ): Promise<boolean> {
    return this.service.sendErrorMessage(
      connectionId,
      this.event,
      errorMessage
    );
  }

  async sendSystemMessage(
    connectionId: string,
    text: string
  ): Promise<boolean> {
    return this.service.sendSystemMessage(connectionId, this.event, text);
  }

  cleanup(): void {
    this.service.cleanup();
  }
}
