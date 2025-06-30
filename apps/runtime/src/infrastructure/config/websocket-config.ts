import { APIGatewayProxyEvent } from 'aws-lambda';

export interface WebSocketConfig {
  endpoint: string;
}

export interface WebSocketEvent extends APIGatewayProxyEvent {
  // WebSocket-specific extensions can be added here if needed
}
