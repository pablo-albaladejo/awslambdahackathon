import { AttributeValue } from '@aws-sdk/client-dynamodb';

/**
 * Session record DTO for DynamoDB (AttributeValue format)
 */
export interface SessionRecordDto {
  PK: AttributeValue;
  SK: AttributeValue;
  sessionId: AttributeValue;
  userId: AttributeValue;
  createdAt: AttributeValue;
  expiresAt: AttributeValue;
  lastActivityAt: AttributeValue;
  isActive: AttributeValue;
  status: AttributeValue;
  metadata: AttributeValue;
  entityType: AttributeValue;
  GSI1PK: AttributeValue;
  GSI1SK: AttributeValue;
  ttl: AttributeValue;
}

/**
 * Session record DTO for DynamoDB (plain format)
 */
export interface SessionRecordPlainDto {
  PK: string;
  SK: string;
  sessionId: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  lastActivityAt: string;
  isActive: boolean;
  status: string;
  metadata: Record<string, unknown>;
  entityType: string;
  GSI1PK: string;
  GSI1SK: string;
  ttl: number;
}

/**
 * Session query DTO for DynamoDB operations
 */
export interface SessionQueryDto {
  PK?: string;
  SK?: string;
  GSI1PK?: string;
  sessionId?: string;
  userId?: string;
  isActive?: boolean;
  status?: string;
  createdAfter?: string;
  createdBefore?: string;
  expiresAfter?: string;
  expiresBefore?: string;
  limit?: number;
  lastEvaluatedKey?: Record<string, AttributeValue>;
}

/**
 * Session batch operation DTO
 */
export interface SessionBatchDto {
  RequestItems: {
    [tableName: string]: {
      Keys: Array<{
        PK: AttributeValue;
        SK: AttributeValue;
      }>;
    };
  };
}
