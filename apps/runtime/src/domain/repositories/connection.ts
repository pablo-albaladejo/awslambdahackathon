import { Connection, ConnectionStatus } from '../entities';
import { ConnectionId, UserId } from '../value-objects';

export interface ConnectionRepository {
  findById(id: ConnectionId): Promise<Connection | null>;
  findByUserId(userId: UserId): Promise<Connection[]>;
  findByStatus(status: ConnectionStatus): Promise<Connection[]>;
  save(connection: Connection): Promise<void>;
  delete(id: ConnectionId): Promise<void>;
  exists(id: ConnectionId): Promise<boolean>;
  updateActivity(id: ConnectionId): Promise<void>;
  findExpiredConnections(): Promise<Connection[]>;
  deleteExpiredConnections(): Promise<void>;
  countByStatus(status: ConnectionStatus): Promise<number>;
}
