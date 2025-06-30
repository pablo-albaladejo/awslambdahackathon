import { AttributeValue } from '@aws-sdk/client-dynamodb';

/**
 * Connection record DTO for DynamoDB (AttributeValue format)
 */
export interface ConnectionRecordDto {
  PK: AttributeValue;
  SK: AttributeValue;
  connectionId: AttributeValue;
  userId?: AttributeValue;
  sessionId?: AttributeValue;
  connectedAt: AttributeValue;
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
 * Connection record DTO for DynamoDB (plain format)
 */
export interface ConnectionRecordPlainDto {
  PK: string;
  SK: string;
  connectionId: string;
  userId?: string;
  sessionId?: string;
  connectedAt: string;
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
 * Connection query DTO for DynamoDB operations
 */
export interface ConnectionQueryDto {
  PK?: string;
  SK?: string;
  GSI1PK?: string;
  connectionId?: string;
  userId?: string;
  sessionId?: string;
  isActive?: boolean;
  status?: string;
  connectedAfter?: string;
  connectedBefore?: string;
  limit?: number;
  lastEvaluatedKey?: Record<string, AttributeValue>;
}

/**
 * Connection batch operation DTO
 */
export interface ConnectionBatchDto {
  RequestItems: {
    [tableName: string]: {
      Keys: Array<{
        PK: AttributeValue;
        SK: AttributeValue;
      }>;
    };
  };
}
