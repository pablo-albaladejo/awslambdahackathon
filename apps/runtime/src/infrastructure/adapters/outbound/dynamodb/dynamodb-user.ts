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
import { User } from '@domain/entities/user';
import { Specification } from '@domain/repositories/specification';
import { UserRepository } from '@domain/repositories/user';
import { ConnectionId, UserId } from '@domain/value-objects';
import { BaseAdapter } from '@infrastructure/adapters/base/base-adapter';
import { UserRecordPlainDto } from '@infrastructure/dto/database/user-record.dto';
import { DynamoDBUserMapper } from '@infrastructure/mappers/database/dynamodb-user.mapper';

export class DynamoDBUserRepository
  extends BaseAdapter
  implements UserRepository
{
  private static readonly SERVICE_NAME = 'DynamoDB';
  private static readonly TABLE_NAME = process.env.WEBSOCKET_CONNECTIONS_TABLE!;

  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly mapper: DynamoDBUserMapper
  ) {
    super();
  }

  async findById(id: UserId): Promise<User | null> {
    return this.executeWithErrorHandling(
      'findById',
      DynamoDBUserRepository.SERVICE_NAME,
      async () => {
        const result = await this.client.send(
          new GetCommand({
            TableName: DynamoDBUserRepository.TABLE_NAME,
            Key: {
              PK: `USER#${id.getValue()}`,
              SK: `PROFILE#${id.getValue()}`,
            },
          })
        );

        if (!result.Item) {
          return null;
        }

        return this.mapper.mapToDomain(result.Item as UserRecordPlainDto);
      },
      { userId: id.getValue() }
    );
  }

  async findByConnectionId(
    connectionId: ConnectionId | string
  ): Promise<User | null> {
    try {
      const connId =
        typeof connectionId === 'string'
          ? connectionId
          : connectionId.getValue();
      const result = await this.client.send(
        new QueryCommand({
          TableName: DynamoDBUserRepository.TABLE_NAME,
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
    return this.executeWithErrorHandling(
      'findByEmail',
      DynamoDBUserRepository.SERVICE_NAME,
      async () => {
        const result = await this.client.send(
          new QueryCommand({
            TableName: DynamoDBUserRepository.TABLE_NAME,
            IndexName: 'GSI1',
            KeyConditionExpression: 'GSI1PK = :gsi1pk',
            ExpressionAttributeValues: {
              ':gsi1pk': `EMAIL#${email}`,
            },
          })
        );

        if (!result.Items || result.Items.length === 0) {
          return null;
        }

        return this.mapper.mapToDomain(result.Items[0] as UserRecordPlainDto);
      },
      { email }
    );
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.executeWithErrorHandling(
      'findByUsername',
      DynamoDBUserRepository.SERVICE_NAME,
      async () => {
        const result = await this.client.send(
          new ScanCommand({
            TableName: DynamoDBUserRepository.TABLE_NAME,
            FilterExpression: 'username = :username',
            ExpressionAttributeValues: {
              ':username': username,
            },
          })
        );

        if (!result.Items || result.Items.length === 0) {
          return null;
        }

        return this.mapper.mapToDomain(result.Items[0] as UserRecordPlainDto);
      },
      { username }
    );
  }

  async findBySpecification(
    specification: Specification<User>
  ): Promise<User[]> {
    return this.executeWithErrorHandling(
      'findBySpecification',
      DynamoDBUserRepository.SERVICE_NAME,
      async () => {
        const result = await this.client.send(
          new ScanCommand({
            TableName: DynamoDBUserRepository.TABLE_NAME,
          })
        );

        if (!result.Items) {
          return [];
        }

        const users = result.Items.map((item: Record<string, unknown>) =>
          this.mapper.mapToDomain(item as unknown as UserRecordPlainDto)
        );
        return users.filter(user => specification.isSatisfiedBy(user));
      }
    );
  }

  async save(user: User): Promise<void> {
    return this.executeWithErrorHandling(
      'save',
      DynamoDBUserRepository.SERVICE_NAME,
      async () => {
        const record = this.mapper.mapToDto(user);
        await this.client.send(
          new PutCommand({
            TableName: DynamoDBUserRepository.TABLE_NAME,
            Item: record,
          })
        );
      },
      { userId: user.getId().getValue() }
    );
  }

  async delete(id: UserId): Promise<void> {
    return this.executeWithErrorHandling(
      'delete',
      DynamoDBUserRepository.SERVICE_NAME,
      async () => {
        await this.client.send(
          new DeleteCommand({
            TableName: DynamoDBUserRepository.TABLE_NAME,
            Key: {
              PK: `USER#${id.getValue()}`,
              SK: `PROFILE#${id.getValue()}`,
            },
          })
        );
      },
      { userId: id.getValue() }
    );
  }

  async exists(id: UserId): Promise<boolean> {
    return this.executeWithErrorHandling(
      'exists',
      DynamoDBUserRepository.SERVICE_NAME,
      async () => {
        const result = await this.client.send(
          new GetCommand({
            TableName: DynamoDBUserRepository.TABLE_NAME,
            Key: {
              PK: `USER#${id.getValue()}`,
              SK: `PROFILE#${id.getValue()}`,
            },
            ProjectionExpression: 'PK',
          })
        );

        return !!result.Item;
      },
      { userId: id.getValue() }
    );
  }

  async findByGroup(group: string): Promise<User[]> {
    return this.executeWithErrorHandling(
      'findByGroup',
      DynamoDBUserRepository.SERVICE_NAME,
      async () => {
        const result = await this.client.send(
          new QueryCommand({
            TableName: DynamoDBUserRepository.TABLE_NAME,
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

        return result.Items.map((item: Record<string, unknown>) =>
          this.mapper.mapToDomain(item as unknown as UserRecordPlainDto)
        );
      },
      { group }
    );
  }

  async updateLastActivity(id: UserId): Promise<void> {
    return this.executeWithErrorHandling(
      'updateLastActivity',
      DynamoDBUserRepository.SERVICE_NAME,
      async () => {
        await this.client.send(
          new UpdateCommand({
            TableName: DynamoDBUserRepository.TABLE_NAME,
            Key: {
              PK: `USER#${id.getValue()}`,
              SK: `PROFILE#${id.getValue()}`,
            },
            UpdateExpression: 'SET lastActivityAt = :lastActivityAt',
            ExpressionAttributeValues: {
              ':lastActivityAt': new Date().toISOString(),
            },
          })
        );
      },
      { userId: id.getValue() }
    );
  }

  async findAll(): Promise<User[]> {
    return this.executeWithErrorHandling(
      'findAll',
      DynamoDBUserRepository.SERVICE_NAME,
      async () => {
        const result = await this.client.send(
          new ScanCommand({
            TableName: DynamoDBUserRepository.TABLE_NAME,
          })
        );

        if (!result.Items) {
          return [];
        }

        return result.Items.map((item: Record<string, unknown>) =>
          this.mapper.mapToDomain(item as unknown as UserRecordPlainDto)
        );
      }
    );
  }
}
