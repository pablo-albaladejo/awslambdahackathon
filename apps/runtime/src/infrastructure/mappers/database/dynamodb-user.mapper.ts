import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { User, UserGroup } from '@domain/entities/user';
import {
  UserQueryDto,
  UserRecordPlainDto,
} from '@infrastructure/dto/database/user-record.dto';
import { DynamoDBQueryMapper } from '@infrastructure/mappers/interfaces/database-mapper.interface';

/**
 * Mapper for User entity to/from DynamoDB records
 */
export class DynamoDBUserMapper
  implements DynamoDBQueryMapper<User, UserRecordPlainDto, UserQueryDto>
{
  private static readonly ENTITY_TYPE = 'USER';
  private static readonly PK_PREFIX = 'USER#';
  private static readonly SK_PREFIX = 'PROFILE#';

  /**
   * Maps User entity to DynamoDB record (plain)
   */
  mapToDto(user: User): UserRecordPlainDto {
    const userId = user.getUserId();
    const createdAt = user.getCreatedAt();

    return {
      PK: `${DynamoDBUserMapper.PK_PREFIX}${userId}`,
      SK: `${DynamoDBUserMapper.SK_PREFIX}${userId}`,
      userId,
      username: user.getUsername(),
      groups: user.getGroups(),
      isActive: user.isActive(),
      createdAt: createdAt.toISOString(),
      lastActivityAt: user.getLastActivityAt().toISOString(),
      entityType: DynamoDBUserMapper.ENTITY_TYPE,
      ttl: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year TTL
    };
  }

  /**
   * Maps DynamoDB record (plain) to User entity
   */
  mapToDomain(record: UserRecordPlainDto): User {
    return User.fromData({
      id: record.userId,
      username: record.username,
      groups: record.groups as UserGroup[], // Type conversion for groups
      isActive: record.isActive,
      createdAt: new Date(record.createdAt),
      lastActivityAt: new Date(record.lastActivityAt),
    });
  }

  /**
   * Maps array of DTOs to domain entities
   */
  mapArrayToDomain(records: UserRecordPlainDto[]): User[] {
    return records.map(record => this.mapToDomain(record));
  }

  /**
   * Maps array of domain entities to DTOs
   */
  mapArrayToDto(users: User[]): UserRecordPlainDto[] {
    return users.map(user => this.mapToDto(user));
  }

  /**
   * Converts plain record to DynamoDB AttributeValue format
   */
  toAttributeValueRecord(
    record: UserRecordPlainDto
  ): Record<string, AttributeValue> {
    return marshall(record, {
      removeUndefinedValues: true,
      convertEmptyValues: false,
    });
  }

  /**
   * Converts DynamoDB AttributeValue record to plain format
   */
  fromAttributeValueRecord(
    record: Record<string, AttributeValue>
  ): UserRecordPlainDto {
    return unmarshall(record) as UserRecordPlainDto;
  }

  /**
   * Creates DynamoDB key for user
   */
  createKey(userId: string): Record<string, AttributeValue> {
    return {
      PK: { S: `${DynamoDBUserMapper.PK_PREFIX}${userId}` },
      SK: { S: `${DynamoDBUserMapper.SK_PREFIX}${userId}` },
    };
  }

  /**
   * Creates DynamoDB key for user
   */
  createUserKey(userId: string): { PK: AttributeValue; SK: AttributeValue } {
    const key = this.createKey(userId);
    return {
      PK: key.PK,
      SK: key.SK,
    };
  }

  /**
   * Maps query DTO to DynamoDB query parameters
   */
  mapQueryToParams(query: UserQueryDto): {
    KeyConditionExpression?: string;
    FilterExpression?: string;
    ExpressionAttributeNames?: Record<string, string>;
    ExpressionAttributeValues?: Record<string, AttributeValue>;
    IndexName?: string;
  } {
    const params: {
      KeyConditionExpression?: string;
      FilterExpression?: string;
      ExpressionAttributeNames?: Record<string, string>;
      ExpressionAttributeValues?: Record<string, AttributeValue>;
      IndexName?: string;
    } = {};

    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, AttributeValue> = {};
    const filterExpressions: string[] = [];

    // Primary key query
    if (query.userId) {
      params.KeyConditionExpression = 'PK = :pk AND SK = :sk';
      expressionAttributeValues[':pk'] = {
        S: `${DynamoDBUserMapper.PK_PREFIX}${query.userId}`,
      };
      expressionAttributeValues[':sk'] = {
        S: `${DynamoDBUserMapper.SK_PREFIX}${query.userId}`,
      };
    }

    // Filters
    if (query.username) {
      filterExpressions.push('#username = :username');
      expressionAttributeNames['#username'] = 'username';
      expressionAttributeValues[':username'] = { S: query.username };
    }

    if (query.isActive !== undefined) {
      filterExpressions.push('#isActive = :isActive');
      expressionAttributeNames['#isActive'] = 'isActive';
      expressionAttributeValues[':isActive'] = { BOOL: query.isActive };
    }

    // Set filter expression
    if (filterExpressions.length > 0) {
      params.FilterExpression = filterExpressions.join(' AND ');
    }

    // Set expression attributes if they exist
    if (Object.keys(expressionAttributeNames).length > 0) {
      params.ExpressionAttributeNames = expressionAttributeNames;
    }

    if (Object.keys(expressionAttributeValues).length > 0) {
      params.ExpressionAttributeValues = expressionAttributeValues;
    }

    return params;
  }

  /**
   * Validates a record before processing
   */
  validateRecord(record: UserRecordPlainDto): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Required fields validation
    if (!record.PK) {
      errors.push('Missing PK');
    }
    if (!record.SK) {
      errors.push('Missing SK');
    }
    if (!record.userId) {
      errors.push('Missing userId');
    }
    if (!record.username) {
      errors.push('Missing username');
    }

    // Groups validation
    if (!Array.isArray(record.groups)) {
      errors.push('Groups must be an array');
    }

    // Date validation
    if (!record.createdAt) {
      errors.push('Missing createdAt');
    }
    if (!record.lastActivityAt) {
      errors.push('Missing lastActivityAt');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Gets the table schema information
   */
  getTableSchema(): {
    tableName: string;
    partitionKey: string;
    sortKey: string;
    ttlAttribute: string;
  } {
    return {
      tableName: 'WebSocketMessages', // Using messages table for user data
      partitionKey: 'PK',
      sortKey: 'SK',
      ttlAttribute: 'ttl',
    };
  }
}
