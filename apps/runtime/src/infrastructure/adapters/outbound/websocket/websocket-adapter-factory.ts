import { CommunicationService } from '@domain/services/communication-service';
import { AwsApiGatewayWebSocketAdapter } from '@infrastructure/adapters/outbound/websocket/aws-api-gateway-adapter';
import type { APIGatewayProxyEvent } from 'aws-lambda';

export interface WebSocketAdapterFactory {
  createWebSocketAdapter(event: APIGatewayProxyEvent): CommunicationService;
}

export class AwsWebSocketAdapterFactory implements WebSocketAdapterFactory {
  createWebSocketAdapter(event: APIGatewayProxyEvent): CommunicationService {
    return new AwsApiGatewayWebSocketAdapter(event);
  }
}
