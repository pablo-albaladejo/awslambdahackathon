import { User } from '@domain/entities';
import { ConnectionId } from '@domain/value-objects';

export interface AuthenticatedConnection {
  connectionId: string;
  userId: string;
  username: string;
  email: string;
  groups?: string[];
  isAuthenticated: boolean;
  authenticatedAt: number;
  ttl: number;
}

export interface StoreAuthenticatedConnectionCommand {
  connectionId: ConnectionId;
  user: User;
  ttl: number;
}

export interface ConnectionManagementService {
  storeAuthenticatedConnection(
    command: StoreAuthenticatedConnectionCommand
  ): Promise<void>;
  findAuthenticatedConnection(
    connectionId: ConnectionId
  ): Promise<AuthenticatedConnection | null>;
  removeAuthenticatedConnection(connectionId: ConnectionId): Promise<void>;
  isConnectionAuthenticated(connectionId: ConnectionId): Promise<boolean>;
  cleanupExpiredConnections(): Promise<void>;
  getUserFromConnection(connectionId: ConnectionId): Promise<User | null>;
}
