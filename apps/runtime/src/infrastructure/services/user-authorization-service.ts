import { logger } from '@awslambdahackathon/utils/lambda';
import { container } from '@config/container';
import { User, UserGroup } from '@domain/entities/user';
import { AuthenticationService } from '@domain/services/authentication-service';
import {
  AuthorizationResult,
  UserAuthorizationService as DomainUserAuthorizationService,
} from '@domain/services/user-authorization-service';
import { ConnectionId } from '@domain/value-objects';

export class UserAuthorizationService
  implements DomainUserAuthorizationService
{
  async hasUserGroup(
    connectionId: ConnectionId,
    requiredGroup: string
  ): Promise<boolean> {
    const user = await this.getUserFromConnection(connectionId);
    if (!user) {
      return false;
    }
    return user.hasGroup(requiredGroup as UserGroup);
  }

  async hasAnyUserGroup(
    connectionId: ConnectionId,
    requiredGroups: string[]
  ): Promise<boolean> {
    const user = await this.getUserFromConnection(connectionId);
    if (!user) {
      return false;
    }
    return user.hasAnyGroup(requiredGroups as UserGroup[]);
  }

  async hasAllUserGroups(
    connectionId: ConnectionId,
    requiredGroups: string[]
  ): Promise<boolean> {
    const user = await this.getUserFromConnection(connectionId);
    if (!user) {
      return false;
    }
    return user.hasAllGroups(requiredGroups as UserGroup[]);
  }

  async canUserSendMessage(
    connectionId: ConnectionId
  ): Promise<AuthorizationResult> {
    try {
      const user = await this.getUserFromConnection(connectionId);

      if (!user) {
        return {
          isAuthorized: false,
          reason: 'User not found',
        };
      }

      const canSend = user.canSendMessage();

      return {
        isAuthorized: canSend,
        reason: canSend ? undefined : 'User cannot send messages',
        requiredGroups: ['user'],
        userGroups: user.getGroups(),
      };
    } catch (error) {
      logger.error('Error checking if user can send message', {
        connectionId: connectionId.getValue(),
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        isAuthorized: false,
        reason: 'Authorization check failed',
      };
    }
  }

  async canUserAccessAdminFeatures(
    connectionId: ConnectionId
  ): Promise<AuthorizationResult> {
    try {
      const user = await this.getUserFromConnection(connectionId);

      if (!user) {
        return {
          isAuthorized: false,
          reason: 'User not found',
        };
      }

      const canAccess = user.canAccessAdminFeatures();

      return {
        isAuthorized: canAccess,
        reason: canAccess ? undefined : 'User cannot access admin features',
        requiredGroups: ['admin', 'moderator'],
        userGroups: user.getGroups(),
      };
    } catch (error) {
      logger.error('Error checking if user can access admin features', {
        connectionId: connectionId.getValue(),
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        isAuthorized: false,
        reason: 'Authorization check failed',
      };
    }
  }

  async canUserManageUsers(
    connectionId: ConnectionId
  ): Promise<AuthorizationResult> {
    try {
      const user = await this.getUserFromConnection(connectionId);

      if (!user) {
        return {
          isAuthorized: false,
          reason: 'User not found',
        };
      }

      const canManage = user.canManageUsers();

      return {
        isAuthorized: canManage,
        reason: canManage ? undefined : 'User cannot manage users',
        requiredGroups: ['admin'],
        userGroups: user.getGroups(),
      };
    } catch (error) {
      logger.error('Error checking if user can manage users', {
        connectionId: connectionId.getValue(),
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        isAuthorized: false,
        reason: 'Authorization check failed',
      };
    }
  }

  async canUserModerateContent(
    connectionId: ConnectionId
  ): Promise<AuthorizationResult> {
    try {
      const user = await this.getUserFromConnection(connectionId);

      if (!user) {
        return {
          isAuthorized: false,
          reason: 'User not found',
        };
      }

      const canModerate = user.canModerateContent();

      return {
        isAuthorized: canModerate,
        reason: canModerate ? undefined : 'User cannot moderate content',
        requiredGroups: ['admin', 'moderator'],
        userGroups: user.getGroups(),
      };
    } catch (error) {
      logger.error('Error checking if user can moderate content', {
        connectionId: connectionId.getValue(),
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        isAuthorized: false,
        reason: 'Authorization check failed',
      };
    }
  }

  validateUserPermissions(
    user: User,
    requiredAction: string
  ): AuthorizationResult {
    try {
      let isAuthorized = false;
      let requiredGroups: UserGroup[] = [];

      switch (requiredAction) {
        case 'send_message':
          isAuthorized = user.canSendMessage();
          break;
        case 'access_admin':
          isAuthorized = user.canAccessAdminFeatures();
          requiredGroups = ['admin', 'moderator'];
          break;
        case 'manage_users':
          isAuthorized = user.canManageUsers();
          requiredGroups = ['admin'];
          break;
        case 'moderate_content':
          isAuthorized = user.canModerateContent();
          requiredGroups = ['admin', 'moderator'];
          break;
        default:
          return {
            isAuthorized: false,
            reason: `Unknown action: ${requiredAction}`,
          };
      }

      return {
        isAuthorized,
        reason: isAuthorized
          ? undefined
          : `User cannot perform action: ${requiredAction}`,
        requiredGroups: requiredGroups.length > 0 ? requiredGroups : undefined,
        userGroups: user.getGroups(),
      };
    } catch (error) {
      logger.error('Error validating user permissions', {
        userId: user.getId().getValue(),
        requiredAction,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        isAuthorized: false,
        reason: 'Permission validation failed',
      };
    }
  }

  private async getUserFromConnection(
    connectionId: ConnectionId
  ): Promise<User | null> {
    const authenticationService = container.get<AuthenticationService>(
      'AuthenticationService'
    );
    return authenticationService.getUserFromConnection(connectionId);
  }

  hasPermission(user: User | null, requiredGroup: UserGroup): boolean {
    if (!user) {
      return false;
    }
    return user.hasGroup(requiredGroup);
  }

  hasAnyPermission(user: User | null, requiredGroups: UserGroup[]): boolean {
    if (!user) {
      return false;
    }
    return user.hasAnyGroup(requiredGroups);
  }

  hasAllPermissions(user: User | null, requiredGroups: UserGroup[]): boolean {
    if (!user) {
      return false;
    }
    return user.hasAllGroups(requiredGroups);
  }
}
