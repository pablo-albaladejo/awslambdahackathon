import { User } from '../entities';
import { ConnectionId } from '../value-objects';

export interface AuthenticationResult {
  success: boolean;
  user?: User;
  error?: string;
}

export interface AuthenticateUserCommand {
  token: string;
}

export interface StoreAuthenticatedConnectionCommand {
  connectionId: ConnectionId;
  user: User;
}

export interface AuthenticationService {
  authenticateUser(
    command: AuthenticateUserCommand
  ): Promise<AuthenticationResult>;
  storeAuthenticatedConnection(
    command: StoreAuthenticatedConnectionCommand
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
