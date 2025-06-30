import { Connection, ConnectionStatus } from '@domain/entities';
import { User } from '@domain/entities/user';
import { ConnectionId, UserId } from '@domain/value-objects';

export interface AuthenticatedConnectionData {
  connectionId: string;
  userId: string;
  username: string;
  email: string;
  groups: string[];
  isAuthenticated: boolean;
  authenticatedAt: number;
  ttl: number;
}

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

  // Authenticated connection methods
  storeAuthenticatedConnection(
    connectionId: ConnectionId,
    user: User,
    ttl: number
  ): Promise<void>;
  findAuthenticatedConnection(
    connectionId: ConnectionId
  ): Promise<AuthenticatedConnectionData | null>;
  removeAuthenticatedConnection(connectionId: ConnectionId): Promise<void>;
  findExpiredAuthenticatedConnections(): Promise<AuthenticatedConnectionData[]>;
}
