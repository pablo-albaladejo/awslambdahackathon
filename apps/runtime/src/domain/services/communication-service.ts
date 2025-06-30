import { ConnectionId } from '@domain/value-objects';

export interface WebSocketMessage {
  type: string;
  data: unknown;
  timestamp: Date;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  groups: string[];
}

export interface CommunicationService {
  sendMessage(
    connectionId: ConnectionId,
    message: WebSocketMessage
  ): Promise<void>;
  sendToUser(userId: string, message: WebSocketMessage): Promise<void>;
  sendToGroup(groupId: string, message: WebSocketMessage): Promise<void>;
  broadcast(message: WebSocketMessage): Promise<void>;
  disconnect(connectionId: ConnectionId): Promise<void>;
}
