import { CommunicationService } from '@domain/services/communication-service';
import type { APIGatewayProxyEvent } from 'aws-lambda';

import { AwsApiGatewayWebSocketAdapter } from './aws-api-gateway-adapter';

export interface WebSocketAdapterFactory {
  createWebSocketAdapter(event: APIGatewayProxyEvent): CommunicationService;
}

export class AwsWebSocketAdapterFactory implements WebSocketAdapterFactory {
  createWebSocketAdapter(event: APIGatewayProxyEvent): CommunicationService {
    return new AwsApiGatewayWebSocketAdapter(event);
  }
}
