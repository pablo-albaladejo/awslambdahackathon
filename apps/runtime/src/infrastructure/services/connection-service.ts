import { logger } from '@awslambdahackathon/utils/lambda';
import { container } from '@config/container';
import { Connection, ConnectionStatus } from '@domain/entities';
import { ConnectionRepository } from '@domain/repositories/connection';
import { ConnectionId, UserId } from '@domain/value-objects';

import {
  ConnectionService as DomainConnectionService,
  RemoveConnectionCommand,
  StoreConnectionCommand,
} from '@/application/services/connection-service';

export class ConnectionService implements DomainConnectionService {
  private readonly connectionRepository: ConnectionRepository;

  constructor() {
    this.connectionRepository = container.get<ConnectionRepository>(
      'connectionRepository'
    );
  }

  async storeConnection(command: StoreConnectionCommand): Promise<void> {
    const connection = Connection.create(command.connectionId.getValue());

    // Use circuit breaker for connection storage
    await container.getCircuitBreakerService().execute(
      'dynamodb',
      'storeConnection',
      async () => {
        await this.connectionRepository.save(connection);
      },
      async () => {
        // Fallback behavior when DynamoDB is unavailable
        throw new Error('Database temporarily unavailable');
      },
      {
        failureThreshold: 3,
        recoveryTimeout: 20000, // 20 seconds
        expectedResponseTime: 500, // 500ms
        monitoringWindow: 60000, // 1 minute
        minimumRequestCount: 5,
      }
    );
  }

  async removeConnection(command: RemoveConnectionCommand): Promise<void> {
    // Use circuit breaker for connection removal
    await container.getCircuitBreakerService().execute(
      'dynamodb',
      'removeConnection',
      async () => {
        await this.connectionRepository.delete(command.connectionId);
      },
      async () => {
        // Fallback behavior when DynamoDB is unavailable
        throw new Error('Database temporarily unavailable');
      },
      {
        failureThreshold: 3,
        recoveryTimeout: 20000, // 20 seconds
        expectedResponseTime: 500, // 500ms
        monitoringWindow: 60000, // 1 minute
        minimumRequestCount: 5,
      }
    );
  }

  async getConnection(connectionId: ConnectionId): Promise<Connection | null> {
    try {
      return await this.connectionRepository.findById(connectionId);
    } catch (error) {
      logger.error('Error getting connection', {
        connectionId: connectionId.getValue(),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async updateConnectionActivity(connectionId: ConnectionId): Promise<void> {
    try {
      await this.connectionRepository.updateActivity(connectionId);
    } catch (error) {
      logger.error('Error updating connection activity', {
        connectionId: connectionId.getValue(),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async findConnectionsByUser(userId: UserId): Promise<Connection[]> {
    try {
      return await this.connectionRepository.findByUserId(userId);
    } catch (error) {
      logger.error('Error finding connections by user', {
        userId: userId.getValue(),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async cleanupExpiredConnections(): Promise<void> {
    try {
      await this.connectionRepository.deleteExpiredConnections();
    } catch (error) {
      logger.error('Error cleaning up expired connections', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async countActiveConnections(): Promise<number> {
    try {
      return await this.connectionRepository.countByStatus(
        ConnectionStatus.CONNECTED
      );
    } catch (error) {
      logger.error('Error counting active connections', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
