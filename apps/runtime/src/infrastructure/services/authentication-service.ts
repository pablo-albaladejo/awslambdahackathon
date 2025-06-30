import { logger } from '@awslambdahackathon/utils/lambda';
import { AUTH_CONFIG } from '@config/constants';
import { container } from '@config/container';
import { User } from '@domain/entities';
import { ConnectionRepository } from '@domain/repositories/connection';
import { UserRepository } from '@domain/repositories/user';
import {
  AuthenticateUserCommand,
  AuthenticationResult,
  AuthenticationService as DomainAuthenticationService,
  StoreAuthConnectionCommand,
} from '@domain/services/authentication-service';
import { ConnectionId, UserId } from '@domain/value-objects';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

export interface AuthenticatedUser {
  userId: string;
  username: string;
  email: string;
  groups?: string[];
}

export interface AuthenticatedConnection {
  connectionId: string;
  user: AuthenticatedUser;
  isAuthenticated: boolean;
  authenticatedAt: number;
  ttl: number;
}

export class AuthenticationService implements DomainAuthenticationService {
  private readonly verifier: ReturnType<typeof CognitoJwtVerifier.create>;
  private readonly userRepository: UserRepository;
  private readonly connectionRepository: ConnectionRepository;

  constructor() {
    logger.info('Initializing AuthenticationService');

    // Validate required environment variables
    const userPoolId = process.env.COGNITO_USER_POOL_ID;
    const clientId = process.env.COGNITO_CLIENT_ID;

    if (!userPoolId) {
      throw new Error('COGNITO_USER_POOL_ID environment variable is required');
    }
    if (!clientId) {
      throw new Error('COGNITO_CLIENT_ID environment variable is required');
    }

    this.verifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: AUTH_CONFIG.TOKEN_USE,
      clientId,
    });

    // Get repositories from container
    this.userRepository = container.get<UserRepository>('userRepository');
    this.connectionRepository = container.get<ConnectionRepository>(
      'connectionRepository'
    );
  }

  async authenticateUser(
    command: AuthenticateUserCommand
  ): Promise<AuthenticationResult> {
    return container
      .getCircuitBreakerService()
      .execute('authentication', 'authenticateUser', async () => {
        try {
          const payload = await this.verifier.verify(command.token);
          const userId = new UserId(payload.sub);

          const user = await this.userRepository.findById(userId);

          if (!user) {
            logger.warn('User not found in database', {
              userId: userId.getValue(),
            });
            return {
              success: false,
              error: 'User not found',
            };
          }

          return {
            success: true,
            user: user,
          };
        } catch (error) {
          logger.error('Authentication failed', {
            error: error instanceof Error ? error.message : String(error),
          });
          return {
            success: false,
            error: 'Authentication failed',
          };
        }
      });
  }

  async storeAuthenticatedConnection(
    command: StoreAuthConnectionCommand
  ): Promise<void> {
    const startTime = Date.now();
    let success = false;
    let errorType: string | undefined;

    try {
      const now = Date.now();
      const ttl = Math.floor(now / 1000) + AUTH_CONFIG.CONNECTION_TTL_SECONDS;

      logger.info('Storing authenticated connection', {
        connectionId: command.connectionId.getValue(),
        userId: command.user.getId().getValue(),
        ttl,
        correlationId: this.generateCorrelationId(),
      });

      await this.connectionRepository.storeAuthenticatedConnection(
        command.connectionId,
        command.user,
        ttl
      );

      success = true;
      logger.info('Authenticated connection stored', {
        connectionId: command.connectionId.getValue(),
        userId: command.user.getId().getValue(),
        ttl,
        correlationId: this.generateCorrelationId(),
      });
    } catch (error) {
      errorType = 'DATABASE_ERROR';
      logger.error('Failed to store authenticated connection', {
        connectionId: command.connectionId.getValue(),
        userId: command.user.getId().getValue(),
        error: error instanceof Error ? error.message : String(error),
        correlationId: this.generateCorrelationId(),
      });
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      await container
        .getMetricsService()
        .recordDatabaseMetrics(
          'store_connection',
          'connections',
          success,
          duration,
          errorType
        );
    }
  }

  async getAuthenticatedConnection(
    connectionId: string
  ): Promise<AuthenticatedConnection | undefined> {
    const startTime = Date.now();
    let success = false;
    let errorType: string | undefined;

    try {
      logger.debug('Getting authenticated connection', {
        connectionId,
        correlationId: this.generateCorrelationId(),
      });

      const connection =
        await this.connectionRepository.findAuthenticatedConnection(
          ConnectionId.create(connectionId)
        );

      if (!connection) {
        logger.debug('Authenticated connection not found', {
          connectionId,
          correlationId: this.generateCorrelationId(),
        });
        return undefined;
      }

      success = true;
      logger.debug('Authenticated connection retrieved', {
        connectionId,
        userId: connection.userId,
        correlationId: this.generateCorrelationId(),
      });

      return {
        connectionId: connection.connectionId,
        user: {
          userId: connection.userId,
          username: connection.username,
          email: connection.email,
          groups: connection.groups,
        },
        isAuthenticated: connection.isAuthenticated,
        authenticatedAt: connection.authenticatedAt,
        ttl: connection.ttl,
      };
    } catch (error) {
      errorType = 'DATABASE_ERROR';
      logger.error('Failed to get authenticated connection', {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
        correlationId: this.generateCorrelationId(),
      });
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      await container
        .getMetricsService()
        .recordDatabaseMetrics(
          'get_connection',
          'connections',
          success,
          duration,
          errorType
        );
    }
  }

  async isConnectionAuthenticated(
    connectionId: ConnectionId
  ): Promise<boolean> {
    try {
      const connection =
        await this.connectionRepository.findAuthenticatedConnection(
          connectionId
        );
      return connection?.isAuthenticated || false;
    } catch (error) {
      logger.error('Failed to check connection authentication status', {
        connectionId: connectionId.getValue(),
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async removeAuthenticatedConnection(
    connectionId: ConnectionId
  ): Promise<void> {
    const startTime = Date.now();
    let success = false;
    let errorType: string | undefined;

    try {
      logger.info('Removing authenticated connection', {
        connectionId: connectionId.getValue(),
        correlationId: this.generateCorrelationId(),
      });

      await this.connectionRepository.removeAuthenticatedConnection(
        connectionId
      );

      success = true;
      logger.info('Authenticated connection removed', {
        connectionId: connectionId.getValue(),
        correlationId: this.generateCorrelationId(),
      });
    } catch (error) {
      errorType = 'DATABASE_ERROR';
      logger.error('Failed to remove authenticated connection', {
        connectionId: connectionId.getValue(),
        error: error instanceof Error ? error.message : String(error),
        correlationId: this.generateCorrelationId(),
      });
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      await container
        .getMetricsService()
        .recordDatabaseMetrics(
          'remove_connection',
          'connections',
          success,
          duration,
          errorType
        );
    }
  }

  async getUserFromConnection(
    connectionId: ConnectionId
  ): Promise<User | null> {
    try {
      const connection =
        await this.connectionRepository.findAuthenticatedConnection(
          connectionId
        );

      if (!connection || !connection.isAuthenticated) {
        return null;
      }

      const user = await this.userRepository.findById(
        UserId.create(connection.userId)
      );
      return user || null;
    } catch (error) {
      logger.error('Failed to get user from connection', {
        connectionId: connectionId.getValue(),
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async hasUserGroup(
    connectionId: ConnectionId,
    requiredGroup: string
  ): Promise<boolean> {
    try {
      const connection =
        await this.connectionRepository.findAuthenticatedConnection(
          connectionId
        );

      if (!connection || !connection.isAuthenticated) {
        return false;
      }

      const user = await this.userRepository.findById(
        UserId.create(connection.userId)
      );
      if (!user) {
        return false;
      }

      return user.getGroups().includes(requiredGroup);
    } catch (error) {
      logger.error('Failed to check user group', {
        connectionId: connectionId.getValue(),
        requiredGroup,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async cleanupExpiredConnections(): Promise<void> {
    const startTime = Date.now();
    let success = false;
    let errorType: string | undefined;

    try {
      logger.info('Starting cleanup of expired connections');

      const expiredConnections =
        await this.connectionRepository.findExpiredAuthenticatedConnections();

      for (const connection of expiredConnections) {
        try {
          await this.connectionRepository.removeAuthenticatedConnection(
            ConnectionId.create(connection.connectionId)
          );
          logger.debug('Removed expired connection', {
            connectionId: connection.connectionId,
          });
        } catch (error) {
          logger.warn('Failed to remove expired connection', {
            connectionId: connection.connectionId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      success = true;
      logger.info('Cleanup of expired connections completed', {
        removedCount: expiredConnections.length,
        correlationId: this.generateCorrelationId(),
      });
    } catch (error) {
      errorType = 'DATABASE_ERROR';
      logger.error('Failed to cleanup expired connections', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: this.generateCorrelationId(),
      });
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      await container
        .getMetricsService()
        .recordDatabaseMetrics(
          'cleanup_connections',
          'connections',
          success,
          duration,
          errorType
        );
    }
  }

  private generateCorrelationId(): string {
    return `auth-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
