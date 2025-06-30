import { logger } from '@awslambdahackathon/utils/lambda';
import { container } from '@config/container';
import { User } from '@domain/entities';
import { ConnectionManagementService as DomainConnectionManagementService } from '@domain/services/connection-management-service';
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
    try {
      const user = await this.getUserFromConnection(connectionId);
      return user?.hasGroup(requiredGroup) ?? false;
    } catch (error) {
      logger.error('Error checking user group', {
        connectionId: connectionId.getValue(),
        requiredGroup,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async hasAnyUserGroup(
    connectionId: ConnectionId,
    requiredGroups: string[]
  ): Promise<boolean> {
    try {
      const user = await this.getUserFromConnection(connectionId);
      return user?.hasAnyGroup(requiredGroups) ?? false;
    } catch (error) {
      logger.error('Error checking user groups (any)', {
        connectionId: connectionId.getValue(),
        requiredGroups,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async hasAllUserGroups(
    connectionId: ConnectionId,
    requiredGroups: string[]
  ): Promise<boolean> {
    try {
      const user = await this.getUserFromConnection(connectionId);
      return user?.hasAllGroups(requiredGroups) ?? false;
    } catch (error) {
      logger.error('Error checking user groups (all)', {
        connectionId: connectionId.getValue(),
        requiredGroups,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
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
      let requiredGroups: string[] = [];

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
    const connectionManagementService =
      container.get<DomainConnectionManagementService>(
        'connectionManagementService'
      );
    return connectionManagementService.getUserFromConnection(connectionId);
  }
}
