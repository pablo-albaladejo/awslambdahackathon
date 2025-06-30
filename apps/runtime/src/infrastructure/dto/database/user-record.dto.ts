import { AttributeValue } from '@aws-sdk/client-dynamodb';

/**
 * User record DTO for DynamoDB (AttributeValue format)
 */
export interface UserRecordDto {
  PK: AttributeValue;
  SK: AttributeValue;
  userId: AttributeValue;
  username: AttributeValue;
  groups: AttributeValue;
  isActive: AttributeValue;
  createdAt: AttributeValue;
  lastActivityAt: AttributeValue;
  entityType: AttributeValue;
  ttl: AttributeValue;
}

/**
 * User record DTO for DynamoDB (plain format)
 */
export interface UserRecordPlainDto {
  PK: string;
  SK: string;
  userId: string;
  username: string;
  groups: string[];
  isActive: boolean;
  createdAt: string;
  lastActivityAt: string;
  entityType: string;
  ttl: number;
}

/**
 * User query DTO for DynamoDB operations
 */
export interface UserQueryDto {
  PK?: string;
  SK?: string;
  userId?: string;
  username?: string;
  isActive?: boolean;
  limit?: number;
  lastEvaluatedKey?: Record<string, AttributeValue>;
}

/**
 * User batch operation DTO
 */
export interface UserBatchDto {
  RequestItems: {
    [tableName: string]: {
      Keys: Array<{
        PK: AttributeValue;
        SK: AttributeValue;
      }>;
    };
  };
}
