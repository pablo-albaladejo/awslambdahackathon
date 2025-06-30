import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { logger } from '@awslambdahackathon/utils/lambda';
import { Connection, ConnectionStatus } from '@domain/entities/connection';
import { ConnectionRepository } from '@domain/repositories/connection';
import { ConnectionId, UserId } from '@domain/value-objects';

export class DynamoDBConnectionRepository implements ConnectionRepository {
  private readonly ddbClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor() {
    this.ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    this.tableName =
      process.env.WEBSOCKET_CONNECTIONS_TABLE || 'websocket-connections';
  }

  async findById(id: ConnectionId): Promise<Connection | null> {
    try {
      const result = await this.ddbClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            pk: `CONNECTION#${id.getValue()}`,
            sk: `CONNECTION#${id.getValue()}`,
          },
        })
      );

      if (!result.Item) {
        return null;
      }

      return Connection.fromData({
        id: result.Item.connectionId,
        userId: result.Item.userId,
        status: result.Item.status as ConnectionStatus,
        connectedAt: new Date(result.Item.connectedAt),
        lastActivityAt: new Date(result.Item.lastActivityAt),
        ttl: result.Item.ttl,
        metadata: result.Item.metadata || {},
      });
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
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'userId-index',
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId.getValue(),
          },
        })
      );

      if (!result.Items) {
        return [];
      }

      return result.Items.map(item =>
        Connection.fromData({
          id: item.connectionId,
          userId: item.userId,
          status: item.status as ConnectionStatus,
          connectedAt: new Date(item.connectedAt),
          lastActivityAt: new Date(item.lastActivityAt),
          ttl: item.ttl,
          metadata: item.metadata || {},
        })
      );
    } catch (error) {
      logger.error('Error finding connections by user ID', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to find connections by user ID');
    }
  }

  async findByStatus(status: ConnectionStatus): Promise<Connection[]> {
    try {
      const result = await this.ddbClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'status-index',
          KeyConditionExpression: 'status = :status',
          ExpressionAttributeValues: {
            ':status': status,
          },
        })
      );

      if (!result.Items) {
        return [];
      }

      return result.Items.map(item =>
        Connection.fromData({
          id: item.connectionId,
          userId: item.userId,
          status: item.status as ConnectionStatus,
          connectedAt: new Date(item.connectedAt),
          lastActivityAt: new Date(item.lastActivityAt),
          ttl: item.ttl,
          metadata: item.metadata || {},
        })
      );
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
            pk: `CONNECTION#${connection.getId().getValue()}`,
            sk: `CONNECTION#${connection.getId().getValue()}`,
            connectionId: connection.getId().getValue(),
            userId: connection.getUserId()?.getValue(),
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
            pk: `CONNECTION#${id.getValue()}`,
            sk: `CONNECTION#${id.getValue()}`,
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
            pk: `CONNECTION#${id.getValue()}`,
            sk: `CONNECTION#${id.getValue()}`,
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
            pk: `CONNECTION#${id.getValue()}`,
            sk: `CONNECTION#${id.getValue()}`,
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

      return result.Items.map(item =>
        Connection.fromData({
          id: item.connectionId,
          userId: item.userId,
          status: item.status as ConnectionStatus,
          connectedAt: new Date(item.connectedAt),
          lastActivityAt: new Date(item.lastActivityAt),
          ttl: item.ttl,
          metadata: item.metadata || {},
        })
      );
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
      const result = await this.ddbClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'status-index',
          KeyConditionExpression: 'status = :status',
          ExpressionAttributeValues: {
            ':status': status,
          },
          Select: 'COUNT',
        })
      );

      return result.Count || 0;
    } catch (error) {
      logger.error('Error counting connections by status', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to count connections by status');
    }
  }
}
