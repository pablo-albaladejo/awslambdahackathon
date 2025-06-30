import { AttributeValue } from '@aws-sdk/client-dynamodb';

/**
 * Message record DTO for DynamoDB (AttributeValue format)
 */
export interface MessageRecordDto {
  PK: AttributeValue;
  SK: AttributeValue;
  messageId: AttributeValue;
  userId: AttributeValue;
  sessionId: AttributeValue;
  content: AttributeValue;
  type: AttributeValue;
  status: AttributeValue;
  createdAt: AttributeValue;
  updatedAt?: AttributeValue;
  metadata: AttributeValue;
  replyToMessageId?: AttributeValue;
  entityType: AttributeValue;
  GSI1PK: AttributeValue;
  GSI1SK: AttributeValue;
  GSI2PK: AttributeValue;
  GSI2SK: AttributeValue;
  ttl: AttributeValue;
}

/**
 * Message record DTO for DynamoDB (plain format)
 */
export interface MessageRecordPlainDto {
  PK: string;
  SK: string;
  messageId: string;
  userId: string;
  sessionId: string;
  content: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  metadata: Record<string, unknown>;
  replyToMessageId?: string;
  entityType: string;
  GSI1PK: string;
  GSI1SK: string;
  GSI2PK: string;
  GSI2SK: string;
  ttl: number;
}

/**
 * Message query DTO for DynamoDB operations
 */
export interface MessageQueryDto {
  PK?: string;
  SK?: string;
  GSI1PK?: string;
  GSI2PK?: string;
  messageId?: string;
  userId?: string;
  sessionId?: string;
  type?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  lastEvaluatedKey?: Record<string, AttributeValue>;
}

/**
 * Message batch operation DTO
 */
export interface MessageBatchDto {
  RequestItems: {
    [tableName: string]: {
      Keys: Array<{
        PK: AttributeValue;
        SK: AttributeValue;
      }>;
    };
  };
}
