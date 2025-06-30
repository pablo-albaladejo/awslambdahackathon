import { Connection, ConnectionStatus } from '@domain/entities/connection';
import { ConnectionId, SessionId, UserId } from '@domain/value-objects';

export interface StoreConnectionCommand {
  connectionId: ConnectionId;
  userId?: UserId;
  sessionId?: SessionId;
}

export interface ConnectionRepository {
  findById(id: ConnectionId): Promise<Connection | null>;
  findByUserId(userId: UserId): Promise<Connection[]>;
  findBySessionId(sessionId: SessionId): Promise<Connection[]>;
  save(connection: Connection): Promise<void>;
  delete(id: ConnectionId): Promise<void>;
  findExpiredConnections(): Promise<Connection[]>;
  updateActivity(connectionId: ConnectionId): Promise<void>;
  deleteExpiredConnections(): Promise<void>;
  countByStatus(status: ConnectionStatus): Promise<number>;
  cleanup(): Promise<void>;
}
