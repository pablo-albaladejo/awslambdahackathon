import { WebSocketMessageService } from '@domain/services/websocket-message-service';
import type { APIGatewayProxyEvent } from 'aws-lambda';

import { AwsApiGatewayWebSocketAdapter } from './aws-api-gateway-adapter';

export interface WebSocketAdapterFactory {
  createWebSocketAdapter(event: APIGatewayProxyEvent): WebSocketMessageService;
}

export class AwsWebSocketAdapterFactory implements WebSocketAdapterFactory {
  createWebSocketAdapter(event: APIGatewayProxyEvent): WebSocketMessageService {
    return new AwsApiGatewayWebSocketAdapter(event);
  }
}
