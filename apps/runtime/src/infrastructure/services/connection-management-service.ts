import { logger } from '@awslambdahackathon/utils/lambda';
import { container } from '@config/container';
import { User } from '@domain/entities';
import { ConnectionError } from '@domain/errors';
import { ConnectionRepository } from '@domain/repositories/connection';
import { UserRepository } from '@domain/repositories/user';
import {
  AuthenticatedConnection,
  ConnectionManagementService as DomainConnectionManagementService,
  StoreAuthenticatedConnectionCommand,
} from '@domain/services/connection-management-service';
import { ConnectionId } from '@domain/value-objects';

export class ConnectionManagementService
  implements DomainConnectionManagementService
{
  private readonly connectionRepository: ConnectionRepository;
  private readonly userRepository: UserRepository;

  constructor() {
    this.connectionRepository = container.get<ConnectionRepository>(
      'ConnectionRepository'
    );
    this.userRepository = container.get<UserRepository>('UserRepository');
  }

  async storeAuthenticatedConnection(
    command: StoreAuthenticatedConnectionCommand
  ): Promise<void> {
    const startTime = Date.now();
    let success = false;
    let errorType: string | undefined;

    try {
      logger.info('Storing authenticated connection', {
        connectionId: command.connectionId.getValue(),
        userId: command.user.getId().getValue(),
        ttl: command.ttl,
        correlationId: this.generateCorrelationId(),
      });

      await this.connectionRepository.storeAuthenticatedConnection(
        command.connectionId,
        command.user,
        command.ttl
      );

      success = true;
      logger.info('Authenticated connection stored', {
        connectionId: command.connectionId.getValue(),
        userId: command.user.getId().getValue(),
        ttl: command.ttl,
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
      throw new ConnectionError(
        'Failed to store authenticated connection',
        command.connectionId.getValue(),
        { error: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      const duration = Date.now() - startTime;
      await container
        .getMetricsService()
        .recordDatabaseMetrics(
          'store_authenticated_connection',
          'connections',
          success,
          duration,
          errorType
        );
    }
  }

  async findAuthenticatedConnection(
    connectionId: ConnectionId
  ): Promise<AuthenticatedConnection | null> {
    const startTime = Date.now();
    let success = false;
    let errorType: string | undefined;

    try {
      logger.debug('Finding authenticated connection', {
        connectionId: connectionId.getValue(),
        correlationId: this.generateCorrelationId(),
      });

      const connection =
        await this.connectionRepository.findAuthenticatedConnection(
          connectionId
        );

      if (!connection) {
        logger.debug('Authenticated connection not found', {
          connectionId: connectionId.getValue(),
          correlationId: this.generateCorrelationId(),
        });
        return null;
      }

      success = true;
      logger.debug('Authenticated connection found', {
        connectionId: connectionId.getValue(),
        userId: connection.userId,
        correlationId: this.generateCorrelationId(),
      });

      return {
        connectionId: connection.connectionId,
        userId: connection.userId,
        username: connection.username,
        email: connection.email,
        groups: connection.groups,
        isAuthenticated: connection.isAuthenticated,
        authenticatedAt: connection.authenticatedAt,
        ttl: connection.ttl,
      };
    } catch (error) {
      errorType = 'DATABASE_ERROR';
      logger.error('Error finding authenticated connection', {
        connectionId: connectionId.getValue(),
        error: error instanceof Error ? error.message : String(error),
        correlationId: this.generateCorrelationId(),
      });
      throw new ConnectionError(
        'Failed to find authenticated connection',
        connectionId.getValue(),
        { error: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      const duration = Date.now() - startTime;
      await container
        .getMetricsService()
        .recordDatabaseMetrics(
          'find_authenticated_connection',
          'connections',
          success,
          duration,
          errorType
        );
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
      logger.error('Error removing authenticated connection', {
        connectionId: connectionId.getValue(),
        error: error instanceof Error ? error.message : String(error),
        correlationId: this.generateCorrelationId(),
      });
      throw new ConnectionError(
        'Failed to remove authenticated connection',
        connectionId.getValue(),
        { error: error instanceof Error ? error.message : String(error) }
      );
    } finally {
      const duration = Date.now() - startTime;
      await container
        .getMetricsService()
        .recordDatabaseMetrics(
          'remove_authenticated_connection',
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
      const connection = await this.findAuthenticatedConnection(connectionId);
      return connection?.isAuthenticated ?? false;
    } catch (error) {
      logger.error('Error checking if connection is authenticated', {
        connectionId: connectionId.getValue(),
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async cleanupExpiredConnections(): Promise<void> {
    try {
      logger.info('Starting cleanup of expired connections');
      await this.connectionRepository.deleteExpiredConnections();
      logger.info('Cleanup of expired connections completed');
    } catch (error) {
      logger.error('Error during cleanup of expired connections', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ConnectionError(
        'Failed to cleanup expired connections',
        undefined,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  async getUserFromConnection(
    connectionId: ConnectionId
  ): Promise<User | null> {
    try {
      const user = await this.userRepository.findByConnectionId(connectionId);

      if (!user) {
        logger.debug('User not found for connection', {
          connectionId: connectionId.getValue(),
        });
        return null;
      }

      return user;
    } catch (error) {
      logger.error('Error getting user from connection', {
        connectionId: connectionId.getValue(),
        error: error instanceof Error ? error.message : String(error),
      });
      throw new ConnectionError(
        'Failed to get user from connection',
        connectionId.getValue(),
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  private generateCorrelationId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
