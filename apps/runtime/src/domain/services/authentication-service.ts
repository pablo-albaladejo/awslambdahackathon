import { User } from '@domain/entities';
import { ConnectionId } from '@domain/value-objects';

export interface AuthenticationResult {
  success: boolean;
  user?: User;
  error?: string;
}

export interface AuthenticateUserCommand {
  token: string;
}

export interface StoreAuthConnectionCommand {
  connectionId: ConnectionId;
  user: User;
}

export interface AuthenticationService {
  authenticateUser(
    command: AuthenticateUserCommand
  ): Promise<AuthenticationResult>;
  storeAuthenticatedConnection(
    command: StoreAuthConnectionCommand
  ): Promise<void>;
  removeAuthenticatedConnection(connectionId: ConnectionId): Promise<void>;
  isConnectionAuthenticated(connectionId: ConnectionId): Promise<boolean>;
  getUserFromConnection(connectionId: ConnectionId): Promise<User | null>;
  hasUserGroup(
    connectionId: ConnectionId,
    requiredGroup: string
  ): Promise<boolean>;
  cleanupExpiredConnections(): Promise<void>;
}
