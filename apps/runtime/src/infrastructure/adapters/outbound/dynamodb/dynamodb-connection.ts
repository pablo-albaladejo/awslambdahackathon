import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { logger } from '@awslambdahackathon/utils/lambda';
import { Connection, ConnectionStatus } from '@domain/entities/connection';
import { User } from '@domain/entities/user';
import { ConnectionRepository } from '@domain/repositories/connection';
import { ConnectionId, SessionId, UserId } from '@domain/value-objects';
import { DynamoDBConfig } from '@infrastructure/config/database-config';

export interface AuthenticatedConnectionData {
  connectionId: string;
  userId: string;
  username: string;
  groups: string[];
  isAuthenticated: boolean;
  authenticatedAt: number;
  ttl: number;
}

export class DynamoDBConnectionRepository implements ConnectionRepository {
  private readonly ddbClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(ddbClient: DynamoDBDocumentClient, config: DynamoDBConfig) {
    this.ddbClient = ddbClient;
    this.tableName = config.tableName;
  }
  cleanup(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  async findById(id: ConnectionId): Promise<Connection | null> {
    try {
      const result = await this.ddbClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            connectionId: id.getValue(),
          },
        })
      );

      if (!result.Item) {
        return null;
      }

      return this.mapToConnection(result.Item);
    } catch (error) {
      logger.error('Error finding connection by ID', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to find connection by ID');
    }
  }

  async findByUserId(userId: UserId): Promise<Connection[]> {
    try {
      const result = await this.ddbClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId.getValue(),
          },
        })
      );

      if (!result.Items) {
        return [];
      }

      return result.Items.map(item => this.mapToConnection(item));
    } catch (error) {
      logger.error('Error finding connections by user ID', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to find connections by user ID');
    }
  }

  async findBySessionId(sessionId: SessionId): Promise<Connection[]> {
    try {
      const result = await this.ddbClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: 'sessionId = :sessionId',
          ExpressionAttributeValues: {
            ':sessionId': sessionId.getValue(),
          },
        })
      );

      if (!result.Items) {
        return [];
      }

      return result.Items.map(item => this.mapToConnection(item));
    } catch (error) {
      logger.error('Error finding connections by session ID', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to find connections by session ID');
    }
  }

  async findByStatus(status: ConnectionStatus): Promise<Connection[]> {
    try {
      const result = await this.ddbClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: '#status = :status',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':status': status,
          },
        })
      );

      if (!result.Items) {
        return [];
      }

      return result.Items.map(item => this.mapToConnection(item));
    } catch (error) {
      logger.error('Error finding connections by status', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to find connections by status');
    }
  }

  async save(connection: Connection): Promise<void> {
    try {
      await this.ddbClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            connectionId: connection.getId().getValue(),
            userId: connection.getUserId()?.getValue(),
            sessionId: connection.getSessionId()?.getValue(),
            status: connection.getStatus(),
            connectedAt: connection.getConnectedAt().toISOString(),
            lastActivityAt: connection.getLastActivityAt().toISOString(),
            ttl: connection.getTtl(),
            metadata: connection.getMetadata(),
            expiresAt: Math.floor(Date.now() / 1000) + connection.getTtl(),
          },
        })
      );
    } catch (error) {
      logger.error('Error saving connection', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to save connection');
    }
  }

  async delete(id: ConnectionId): Promise<void> {
    try {
      await this.ddbClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            connectionId: id.getValue(),
          },
        })
      );
    } catch (error) {
      logger.error('Error deleting connection', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to delete connection');
    }
  }

  async exists(id: ConnectionId): Promise<boolean> {
    try {
      const result = await this.ddbClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            connectionId: id.getValue(),
          },
        })
      );

      return !!result.Item;
    } catch (error) {
      logger.error('Error checking if connection exists', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to check if connection exists');
    }
  }

  async updateActivity(id: ConnectionId): Promise<void> {
    try {
      await this.ddbClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            connectionId: id.getValue(),
          },
          UpdateExpression: 'SET lastActivityAt = :lastActivityAt',
          ExpressionAttributeValues: {
            ':lastActivityAt': new Date().toISOString(),
          },
        })
      );
    } catch (error) {
      logger.error('Error updating connection activity', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to update connection activity');
    }
  }

  async findExpiredConnections(): Promise<Connection[]> {
    try {
      const now = Math.floor(Date.now() / 1000);
      const result = await this.ddbClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: 'expiresAt < :now',
          ExpressionAttributeValues: {
            ':now': now,
          },
        })
      );

      if (!result.Items) {
        return [];
      }

      return result.Items.map(item => this.mapToConnection(item));
    } catch (error) {
      logger.error('Error finding expired connections', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to find expired connections');
    }
  }

  async deleteExpiredConnections(): Promise<void> {
    try {
      const expiredConnections = await this.findExpiredConnections();

      for (const connection of expiredConnections) {
        await this.delete(connection.getId());
      }
    } catch (error) {
      logger.error('Error deleting expired connections', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to delete expired connections');
    }
  }

  async countByStatus(status: ConnectionStatus): Promise<number> {
    try {
      const connections = await this.findByStatus(status);
      return connections.length;
    } catch (error) {
      logger.error('Error counting connections by status', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to count connections by status');
    }
  }

  // Authenticated connection methods
  async storeAuthenticatedConnection(
    connectionId: ConnectionId,
    user: User,
    ttl: number
  ): Promise<void> {
    try {
      const now = Date.now();
      await this.ddbClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            connectionId: `AUTH#${connectionId.getValue()}`,
            userId: user.getId().getValue(),
            username: user.getUsername(),
            groups: user.getGroups(),
            isAuthenticated: true,
            authenticatedAt: now,
            ttl,
            expiresAt: Math.floor(now / 1000) + ttl,
          },
        })
      );
    } catch (error) {
      logger.error('Error storing authenticated connection', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to store authenticated connection');
    }
  }

  async findAuthenticatedConnection(
    connectionId: ConnectionId
  ): Promise<AuthenticatedConnectionData | null> {
    try {
      const result = await this.ddbClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            connectionId: `AUTH#${connectionId.getValue()}`,
          },
        })
      );

      if (!result.Item || !result.Item.isAuthenticated) {
        return null;
      }

      return {
        connectionId: result.Item.connectionId,
        userId: result.Item.userId,
        username: result.Item.username,
        groups: result.Item.groups || [],
        isAuthenticated: result.Item.isAuthenticated,
        authenticatedAt: result.Item.authenticatedAt,
        ttl: result.Item.ttl,
      };
    } catch (error) {
      logger.error('Error finding authenticated connection', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to find authenticated connection');
    }
  }

  async removeAuthenticatedConnection(
    connectionId: ConnectionId
  ): Promise<void> {
    try {
      await this.ddbClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            connectionId: `AUTH#${connectionId.getValue()}`,
          },
        })
      );
    } catch (error) {
      logger.error('Error removing authenticated connection', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to remove authenticated connection');
    }
  }

  async findExpiredAuthenticatedConnections(): Promise<
    AuthenticatedConnectionData[]
  > {
    try {
      const now = Math.floor(Date.now() / 1000);
      const result = await this.ddbClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression:
            'begins_with(connectionId, :authPrefix) AND expiresAt < :now',
          ExpressionAttributeValues: {
            ':authPrefix': 'AUTH#',
            ':now': now,
          },
        })
      );

      if (!result.Items) {
        return [];
      }

      return result.Items.filter(item => item.isAuthenticated).map(item => ({
        connectionId: item.connectionId,
        userId: item.userId,
        username: item.username,
        groups: item.groups || [],
        isAuthenticated: item.isAuthenticated,
        authenticatedAt: item.authenticatedAt,
        ttl: item.ttl,
      }));
    } catch (error) {
      logger.error('Error finding expired authenticated connections', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to find expired authenticated connections');
    }
  }

  private mapToConnection(item: Record<string, unknown>): Connection {
    // Safe type conversion with validation
    const safeString = (value: unknown): string => {
      if (typeof value === 'string') return value;
      throw new Error(`Expected string, got ${typeof value}`);
    };

    const safeNumber = (value: unknown): number | undefined => {
      if (value === undefined || value === null) return undefined;
      if (typeof value === 'number') return value;
      throw new Error(`Expected number, got ${typeof value}`);
    };

    const safeConnectionStatus = (value: unknown): ConnectionStatus => {
      if (
        typeof value === 'string' &&
        ['connected', 'authenticated', 'disconnected', 'suspended'].includes(
          value
        )
      ) {
        return value as ConnectionStatus;
      }
      throw new Error(`Invalid ConnectionStatus: ${value}`);
    };

    return Connection.fromData({
      id: safeString(item.connectionId),
      userId: item.userId ? safeString(item.userId) : undefined,
      sessionId: item.sessionId ? safeString(item.sessionId) : undefined,
      status: safeConnectionStatus(item.status),
      connectedAt: new Date(safeString(item.connectedAt)),
      lastActivityAt: item.lastActivityAt
        ? new Date(safeString(item.lastActivityAt))
        : undefined,
      ttl: safeNumber(item.ttl),
      metadata: (item.metadata as Record<string, unknown>) || {},
    });
  }
}
