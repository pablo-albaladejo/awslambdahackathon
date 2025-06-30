import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { logger } from '@awslambdahackathon/utils/lambda';
import { User } from '@domain/entities/user';
import { UserRepository } from '@domain/repositories/user';
import { ConnectionId, UserId } from '@domain/value-objects';

export class DynamoDBUserRepository implements UserRepository {
  private readonly ddbClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor() {
    this.ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    this.tableName =
      process.env.WEBSOCKET_CONNECTIONS_TABLE || 'websocket-connections';
  }

  async findById(id: UserId): Promise<User | null> {
    try {
      const result = await this.ddbClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            pk: `USER#${id.getValue()}`,
            sk: `USER#${id.getValue()}`,
          },
        })
      );

      if (!result.Item) {
        return null;
      }

      return User.fromData({
        id: result.Item.userId,
        username: result.Item.username,
        email: result.Item.email,
        groups: result.Item.groups || [],
        createdAt: new Date(result.Item.createdAt),
        lastActivityAt: new Date(result.Item.lastActivityAt),
        isActive: result.Item.isActive !== false,
      });
    } catch (error) {
      logger.error('Error finding user by ID', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to find user by ID');
    }
  }

  async findByConnectionId(connectionId: ConnectionId): Promise<User | null> {
    try {
      const result = await this.ddbClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'connectionId-index',
          KeyConditionExpression: 'connectionId = :connectionId',
          ExpressionAttributeValues: {
            ':connectionId': connectionId.getValue(),
          },
        })
      );

      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      const userItem = result.Items[0];
      return User.fromData({
        id: userItem.userId,
        username: userItem.username,
        email: userItem.email,
        groups: userItem.groups || [],
        createdAt: new Date(userItem.createdAt),
        lastActivityAt: new Date(userItem.lastActivityAt),
        isActive: userItem.isActive !== false,
      });
    } catch (error) {
      logger.error('Error finding user by connection ID', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to find user by connection ID');
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      const result = await this.ddbClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'email-index',
          KeyConditionExpression: 'email = :email',
          ExpressionAttributeValues: {
            ':email': email,
          },
        })
      );

      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      const userItem = result.Items[0];
      return User.fromData({
        id: userItem.userId,
        username: userItem.username,
        email: userItem.email,
        groups: userItem.groups || [],
        createdAt: new Date(userItem.createdAt),
        lastActivityAt: new Date(userItem.lastActivityAt),
        isActive: userItem.isActive !== false,
      });
    } catch (error) {
      logger.error('Error finding user by email', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to find user by email');
    }
  }

  async save(user: User): Promise<void> {
    try {
      await this.ddbClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            pk: `USER#${user.getId().getValue()}`,
            sk: `USER#${user.getId().getValue()}`,
            userId: user.getId().getValue(),
            username: user.getUsername(),
            email: user.getEmail(),
            groups: user.getGroups(),
            createdAt: user.getCreatedAt().toISOString(),
            lastActivityAt: user.getLastActivityAt().toISOString(),
            isActive: user.isUserActive(),
            ttl: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
          },
        })
      );
    } catch (error) {
      logger.error('Error saving user', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to save user');
    }
  }

  async delete(id: UserId): Promise<void> {
    try {
      await this.ddbClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            pk: `USER#${id.getValue()}`,
            sk: `USER#${id.getValue()}`,
          },
        })
      );
    } catch (error) {
      logger.error('Error deleting user', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to delete user');
    }
  }

  async exists(id: UserId): Promise<boolean> {
    try {
      const result = await this.ddbClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            pk: `USER#${id.getValue()}`,
            sk: `USER#${id.getValue()}`,
          },
        })
      );

      return !!result.Item;
    } catch (error) {
      logger.error('Error checking if user exists', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to check if user exists');
    }
  }

  async findByGroup(group: string): Promise<User[]> {
    try {
      const result = await this.ddbClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'groups-index',
          KeyConditionExpression: 'groupName = :groupName',
          ExpressionAttributeValues: {
            ':groupName': group,
          },
        })
      );

      if (!result.Items) {
        return [];
      }

      return result.Items.map(item =>
        User.fromData({
          id: item.userId,
          username: item.username,
          email: item.email,
          groups: item.groups || [],
          createdAt: new Date(item.createdAt),
          lastActivityAt: new Date(item.lastActivityAt),
          isActive: item.isActive !== false,
        })
      );
    } catch (error) {
      logger.error('Error finding users by group', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to find users by group');
    }
  }

  async updateLastActivity(id: UserId): Promise<void> {
    try {
      await this.ddbClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            pk: `USER#${id.getValue()}`,
            sk: `USER#${id.getValue()}`,
          },
          UpdateExpression: 'SET lastActivityAt = :lastActivityAt',
          ExpressionAttributeValues: {
            ':lastActivityAt': new Date().toISOString(),
          },
        })
      );
    } catch (error) {
      logger.error('Error updating user last activity', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to update user last activity');
    }
  }
}
