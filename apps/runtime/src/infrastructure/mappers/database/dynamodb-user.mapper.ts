import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

import { User, UserGroup } from '../../../domain/entities/user';
import { BidirectionalMapper } from '../../../shared/mappers/mapper.interface';
import {
  UserQueryDto,
  UserRecordPlainDto,
} from '../../dto/database/user-record.dto';

/**
 * Mapper for User entity to/from DynamoDB records
 */
export class DynamoDBUserMapper
  implements BidirectionalMapper<User, UserRecordPlainDto>
{
  private static readonly ENTITY_TYPE = 'USER';
  private static readonly PK_PREFIX = 'USER#';
  private static readonly SK_PREFIX = 'PROFILE#';

  /**
   * Maps User entity to DynamoDB record (plain)
   */
  mapToDto(user: User): UserRecordPlainDto {
    const userId = user.getUserId();

    return {
      PK: `${DynamoDBUserMapper.PK_PREFIX}${userId}`,
      SK: `${DynamoDBUserMapper.SK_PREFIX}${userId}`,
      username: user.getUsername(),
      email: user.getEmail(),
      groups: user.getGroups(),
      isActive: user.isActive(),
      createdAt: user.getCreatedAt().toISOString(),
      lastActivityAt: user.getLastActivityAt().toISOString(),
      entityType: DynamoDBUserMapper.ENTITY_TYPE,
      GSI1PK: `EMAIL#${user.getEmail()}`,
      GSI1SK: `USER#${userId}`,
      ttl: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year TTL
    };
  }

  /**
   * Maps DynamoDB record (plain) to User entity
   */
  mapToDomain(record: UserRecordPlainDto): User {
    const userId = this.extractUserIdFromPK(record.PK);

    return User.fromData({
      id: userId,
      username: record.username,
      email: record.email,
      groups: record.groups as UserGroup[],
      isActive: record.isActive,
      createdAt: new Date(record.createdAt),
      lastActivityAt: new Date(record.lastActivityAt),
    });
  }

  /**
   * Maps array of User entities to DynamoDB records
   */
  mapArrayToDto(users: User[]): UserRecordPlainDto[] {
    return users.map(user => this.mapToDto(user));
  }

  /**
   * Maps array of DynamoDB records to User entities
   */
  mapArrayToDomain(records: UserRecordPlainDto[]): User[] {
    return records.map(record => this.mapToDomain(record));
  }

  /**
   * Maps User entity to DynamoDB AttributeValue record
   */
  toAttributeValueRecord(user: User): Record<string, AttributeValue> {
    const plainRecord = this.mapToDto(user);
    return marshall(plainRecord, {
      convertEmptyValues: false,
      removeUndefinedValues: true,
    });
  }

  /**
   * Maps DynamoDB AttributeValue record to User entity
   */
  fromAttributeValueRecord(record: Record<string, AttributeValue>): User {
    const plainRecord = unmarshall(record) as UserRecordPlainDto;
    return this.mapToDomain(plainRecord);
  }

  /**
   * Creates DynamoDB key for user lookup
   */
  createUserKey(userId: string): { PK: string; SK: string } {
    return {
      PK: `${DynamoDBUserMapper.PK_PREFIX}${userId}`,
      SK: `${DynamoDBUserMapper.SK_PREFIX}${userId}`,
    };
  }

  /**
   * Creates DynamoDB key with AttributeValues
   */
  createUserKeyAttributeValues(userId: string): {
    PK: AttributeValue;
    SK: AttributeValue;
  } {
    const key = this.createUserKey(userId);
    return {
      PK: { S: key.PK },
      SK: { S: key.SK },
    };
  }

  /**
   * Creates GSI1 key for email lookup
   */
  createEmailKey(email: string): { GSI1PK: string; GSI1SK?: string } {
    return {
      GSI1PK: `EMAIL#${email}`,
    };
  }

  /**
   * Maps UserQueryDto to DynamoDB query parameters
   */
  mapQueryToParams(query: UserQueryDto): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    if (query.userId) {
      params.KeyConditionExpression = 'PK = :pk AND SK = :sk';
      params.ExpressionAttributeValues = {
        ':pk': { S: `${DynamoDBUserMapper.PK_PREFIX}${query.userId}` },
        ':sk': { S: `${DynamoDBUserMapper.SK_PREFIX}${query.userId}` },
      };
    } else if (query.email) {
      params.IndexName = 'GSI1';
      params.KeyConditionExpression = 'GSI1PK = :gsi1pk';
      params.ExpressionAttributeValues = {
        ':gsi1pk': { S: `EMAIL#${query.email}` },
      };
    }

    // Add filter expressions
    const filterExpressions: string[] = [];
    const expressionAttributeValues: Record<string, AttributeValue> =
      (params.ExpressionAttributeValues as Record<string, AttributeValue>) ||
      {};

    if (query.username) {
      filterExpressions.push('username = :username');
      expressionAttributeValues[':username'] = { S: query.username };
    }

    if (query.isActive !== undefined) {
      filterExpressions.push('isActive = :isActive');
      expressionAttributeValues[':isActive'] = { BOOL: query.isActive };
    }

    if (query.groups && query.groups.length > 0) {
      filterExpressions.push('contains(groups, :group)');
      expressionAttributeValues[':group'] = { S: query.groups[0] };
    }

    if (query.createdAfter) {
      filterExpressions.push('createdAt >= :createdAfter');
      expressionAttributeValues[':createdAfter'] = { S: query.createdAfter };
    }

    if (query.createdBefore) {
      filterExpressions.push('createdAt <= :createdBefore');
      expressionAttributeValues[':createdBefore'] = { S: query.createdBefore };
    }

    if (filterExpressions.length > 0) {
      params.FilterExpression = filterExpressions.join(' AND ');
    }

    params.ExpressionAttributeValues = expressionAttributeValues;

    if (query.limit) {
      params.Limit = query.limit;
    }

    if (query.exclusiveStartKey) {
      params.ExclusiveStartKey = query.exclusiveStartKey;
    }

    return params;
  }

  /**
   * Extracts user ID from DynamoDB PK
   */
  private extractUserIdFromPK(pk: string): string {
    return pk.replace(DynamoDBUserMapper.PK_PREFIX, '');
  }

  /**
   * Validates that a record is a valid user record
   */
  isValidUserRecord(record: Record<string, AttributeValue>): boolean {
    try {
      const unmarshalled = unmarshall(record) as UserRecordPlainDto;
      return (
        unmarshalled.entityType === DynamoDBUserMapper.ENTITY_TYPE &&
        unmarshalled.PK?.startsWith(DynamoDBUserMapper.PK_PREFIX) &&
        unmarshalled.SK?.startsWith(DynamoDBUserMapper.SK_PREFIX) &&
        typeof unmarshalled.username === 'string' &&
        typeof unmarshalled.email === 'string' &&
        Array.isArray(unmarshalled.groups) &&
        typeof unmarshalled.isActive === 'boolean'
      );
    } catch {
      return false;
    }
  }
}
