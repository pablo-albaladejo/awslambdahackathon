import { logger } from '@awslambdahackathon/utils/lambda';
import { CIRCUIT_BREAKER_CONFIG } from '@config/constants';
import { container } from '@config/container';
import { Connection, ConnectionStatus } from '@domain/entities';
import { ConnectionRepository } from '@domain/repositories/connection';
import {
  ConnectionService as DomainConnectionService,
  RemoveConnectionCommand,
  StoreConnectionCommand,
} from '@domain/services/connection-service';
import { ConnectionId, UserId } from '@domain/value-objects';

export class ConnectionService implements DomainConnectionService {
  private readonly connectionRepository: ConnectionRepository;

  constructor() {
    this.connectionRepository = container.get<ConnectionRepository>(
      'ConnectionRepository'
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
        failureThreshold: CIRCUIT_BREAKER_CONFIG.DEFAULT_FAILURE_THRESHOLD,
        recoveryTimeout: CIRCUIT_BREAKER_CONFIG.DEFAULT_RECOVERY_TIMEOUT,
        expectedResponseTime:
          CIRCUIT_BREAKER_CONFIG.DEFAULT_EXPECTED_RESPONSE_TIME,
        monitoringWindow: CIRCUIT_BREAKER_CONFIG.DEFAULT_MONITORING_WINDOW,
        minimumRequestCount:
          CIRCUIT_BREAKER_CONFIG.DEFAULT_MINIMUM_REQUEST_COUNT,
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
        failureThreshold: CIRCUIT_BREAKER_CONFIG.DEFAULT_FAILURE_THRESHOLD,
        recoveryTimeout: CIRCUIT_BREAKER_CONFIG.DEFAULT_RECOVERY_TIMEOUT,
        expectedResponseTime:
          CIRCUIT_BREAKER_CONFIG.DEFAULT_EXPECTED_RESPONSE_TIME,
        monitoringWindow: CIRCUIT_BREAKER_CONFIG.DEFAULT_MONITORING_WINDOW,
        minimumRequestCount:
          CIRCUIT_BREAKER_CONFIG.DEFAULT_MINIMUM_REQUEST_COUNT,
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
