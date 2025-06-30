import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
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
import { DynamoDBConfig } from '@config/container';
import { User, UserGroup } from '@domain/entities/user';
import { DomainError } from '@domain/errors/domain-errors';
import { Specification } from '@domain/repositories/specification';
import { UserRepository } from '@domain/repositories/user';
import { ConnectionId, UserId } from '@domain/value-objects';

interface UserRecord {
  id: string;
  username: string;
  email: string;
  groups: UserGroup[];
  createdAt: string;
  lastActivityAt: string;
  isActive: boolean;
}

export class DynamoDBUserRepository implements UserRepository {
  private readonly ddbClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(config: DynamoDBConfig) {
    const clientConfig: DynamoDBClientConfig = { region: config.region };
    if (config.endpoint) {
      clientConfig.endpoint = config.endpoint;
    }

    this.ddbClient = DynamoDBDocumentClient.from(
      new DynamoDBClient(clientConfig)
    );
    this.tableName = config.tableName;
  }

  async findById(id: UserId | string): Promise<User | null> {
    try {
      const userId = typeof id === 'string' ? id : id.getValue();
      const result = await this.ddbClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            pk: `USER#${userId}`,
            sk: `USER#${userId}`,
          },
        })
      );

      if (!result.Item) {
        return null;
      }

      const record = result.Item as UserRecord;
      return this.mapToUser(record);
    } catch (error) {
      throw new DomainError('Failed to find user by ID', 'INTERNAL_ERROR', {
        error,
      });
    }
  }

  async findByConnectionId(
    connectionId: ConnectionId | string
  ): Promise<User | null> {
    try {
      const connId =
        typeof connectionId === 'string'
          ? connectionId
          : connectionId.getValue();
      const result = await this.ddbClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'connectionId-index',
          KeyConditionExpression: 'connectionId = :connectionId',
          ExpressionAttributeValues: {
            ':connectionId': connId,
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

      const record = result.Items[0] as UserRecord;
      return this.mapToUser(record);
    } catch (error) {
      throw new DomainError('Failed to find user by email', 'INTERNAL_ERROR', {
        error,
      });
    }
  }

  async findByUsername(username: string): Promise<User | null> {
    try {
      const result = await this.ddbClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'username-index',
          KeyConditionExpression: 'username = :username',
          ExpressionAttributeValues: {
            ':username': username,
          },
        })
      );

      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      const record = result.Items[0] as UserRecord;
      return this.mapToUser(record);
    } catch (error) {
      throw new DomainError(
        'Failed to find user by username',
        'INTERNAL_ERROR',
        { error }
      );
    }
  }

  async findBySpecification(
    specification: Specification<User>
  ): Promise<User[]> {
    try {
      const result = await this.ddbClient.send(
        new ScanCommand({
          TableName: this.tableName,
        })
      );

      if (!result.Items) {
        return [];
      }

      const users = result.Items.map(item =>
        this.mapToUser(item as UserRecord)
      );
      return users.filter(user => specification.isSatisfiedBy(user));
    } catch (error) {
      throw new DomainError(
        'Failed to find users by specification',
        'INTERNAL_ERROR',
        { error }
      );
    }
  }

  async save(user: User): Promise<void> {
    try {
      const record = this.mapToRecord(user);
      await this.ddbClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            pk: `USER#${record.id}`,
            sk: `USER#${record.id}`,
            ...record,
          },
        })
      );
    } catch (error) {
      throw new DomainError('Failed to save user', 'INTERNAL_ERROR', { error });
    }
  }

  async delete(id: UserId | string): Promise<void> {
    try {
      const userId = typeof id === 'string' ? id : id.getValue();
      await this.ddbClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            pk: `USER#${userId}`,
            sk: `USER#${userId}`,
          },
        })
      );
    } catch (error) {
      throw new DomainError('Failed to delete user', 'INTERNAL_ERROR', {
        error,
      });
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

  private mapToUser(record: UserRecord): User {
    return User.fromData({
      id: record.id,
      username: record.username,
      email: record.email,
      groups: record.groups,
      createdAt: new Date(record.createdAt),
      lastActivityAt: new Date(record.lastActivityAt),
      isActive: record.isActive,
    });
  }

  private mapToRecord(user: User): UserRecord {
    const data = user.toJSON();
    return {
      id: data.id as string,
      username: data.username as string,
      email: data.email as string,
      groups: data.groups as UserGroup[],
      createdAt: (data.createdAt as Date).toISOString(),
      lastActivityAt: (data.lastActivityAt as Date).toISOString(),
      isActive: data.isActive as boolean,
    };
  }
}
