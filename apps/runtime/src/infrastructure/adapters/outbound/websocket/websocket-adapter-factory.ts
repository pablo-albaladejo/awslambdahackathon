import type { APIGatewayProxyEvent } from 'aws-lambda';

import { AwsApiGatewayWebSocketAdapter } from './aws-api-gateway-adapter';

import { WebSocketMessageService } from '@/application/services/websocket-message-service';

export interface WebSocketAdapterFactory {
  createWebSocketAdapter(event: APIGatewayProxyEvent): WebSocketMessageService;
}

export class AwsWebSocketAdapterFactory implements WebSocketAdapterFactory {
  createWebSocketAdapter(event: APIGatewayProxyEvent): WebSocketMessageService {
    return new AwsApiGatewayWebSocketAdapter(event);
  }
}
