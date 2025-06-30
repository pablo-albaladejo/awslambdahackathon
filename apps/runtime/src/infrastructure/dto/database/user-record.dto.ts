import { AttributeValue } from '@aws-sdk/client-dynamodb';

/**
 * User record DTO for DynamoDB (AttributeValue format)
 */
export interface UserRecordDto {
  PK: AttributeValue;
  SK: AttributeValue;
  userId: AttributeValue;
  username: AttributeValue;
  email: AttributeValue;
  groups: AttributeValue;
  isActive: AttributeValue;
  createdAt: AttributeValue;
  lastActivityAt: AttributeValue;
  entityType: AttributeValue;
  GSI1PK: AttributeValue;
  GSI1SK: AttributeValue;
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
  email: string;
  groups: string[];
  isActive: boolean;
  createdAt: string;
  lastActivityAt: string;
  entityType: string;
  GSI1PK: string;
  GSI1SK: string;
  ttl: number;
}

/**
 * User query DTO for DynamoDB operations
 */
export interface UserQueryDto {
  PK?: string;
  SK?: string;
  GSI1PK?: string;
  userId?: string;
  email?: string;
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
