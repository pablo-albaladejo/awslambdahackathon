import { User } from '@domain/entities';
import { ConnectionId } from '@domain/value-objects';

export interface AuthorizationResult {
  isAuthorized: boolean;
  reason?: string;
  requiredGroups?: string[];
  userGroups?: string[];
}

export interface UserAuthorizationService {
  hasUserGroup(
    connectionId: ConnectionId,
    requiredGroup: string
  ): Promise<boolean>;
  hasAnyUserGroup(
    connectionId: ConnectionId,
    requiredGroups: string[]
  ): Promise<boolean>;
  hasAllUserGroups(
    connectionId: ConnectionId,
    requiredGroups: string[]
  ): Promise<boolean>;
  canUserSendMessage(connectionId: ConnectionId): Promise<AuthorizationResult>;
  canUserAccessAdminFeatures(
    connectionId: ConnectionId
  ): Promise<AuthorizationResult>;
  canUserManageUsers(connectionId: ConnectionId): Promise<AuthorizationResult>;
  canUserModerateContent(
    connectionId: ConnectionId
  ): Promise<AuthorizationResult>;
  validateUserPermissions(
    user: User,
    requiredAction: string
  ): AuthorizationResult;
}
