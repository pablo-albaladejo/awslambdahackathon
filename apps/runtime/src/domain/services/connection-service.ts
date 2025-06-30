import { Connection } from '@domain/entities';
import { ConnectionId, UserId } from '@domain/value-objects';

export interface StoreConnectionCommand {
  connectionId: ConnectionId;
}

export interface RemoveConnectionCommand {
  connectionId: ConnectionId;
}

export interface ConnectionService {
  storeConnection(command: StoreConnectionCommand): Promise<void>;
  removeConnection(command: RemoveConnectionCommand): Promise<void>;
  getConnection(connectionId: ConnectionId): Promise<Connection | null>;
  updateConnectionActivity(connectionId: ConnectionId): Promise<void>;
  findConnectionsByUser(userId: UserId): Promise<Connection[]>;
  cleanupExpiredConnections(): Promise<void>;
  countActiveConnections(): Promise<number>;
}
