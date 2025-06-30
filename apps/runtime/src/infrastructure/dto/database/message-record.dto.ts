import { AttributeValue } from '@aws-sdk/client-dynamodb';

/**
 * DTO for Message records in DynamoDB
 */
export interface MessageRecordDto {
  /** Primary key - Session ID */
  PK: AttributeValue;

  /** Sort key - Message ID with timestamp */
  SK: AttributeValue;

  /** Message ID */
  messageId: AttributeValue;

  /** User ID who sent the message */
  userId: AttributeValue;

  /** Session ID */
  sessionId: AttributeValue;

  /** Message content */
  content: AttributeValue;

  /** Message type */
  type: AttributeValue;

  /** Message status */
  status: AttributeValue;

  /** Creation timestamp */
  createdAt: AttributeValue;

  /** Optional metadata */
  metadata?: AttributeValue;

  /** Reply to message ID */
  replyToMessageId?: AttributeValue;

  /** Time to live for the record */
  ttl?: AttributeValue;

  /** Entity type identifier */
  entityType: AttributeValue;

  /** GSI1 Primary Key - User ID for user's messages */
  GSI1PK?: AttributeValue;

  /** GSI1 Sort Key - Timestamp for ordering */
  GSI1SK?: AttributeValue;

  /** GSI2 Primary Key - Message type for filtering */
  GSI2PK?: AttributeValue;

  /** GSI2 Sort Key - Status and timestamp */
  GSI2SK?: AttributeValue;
}

/**
 * Simplified DTO for Message records
 */
export interface MessageRecordPlainDto {
  /** Primary key - Session ID */
  PK: string;

  /** Sort key - Message ID with timestamp */
  SK: string;

  /** Message ID */
  messageId: string;

  /** User ID who sent the message */
  userId: string;

  /** Session ID */
  sessionId: string;

  /** Message content */
  content: string;

  /** Message type */
  type: string;

  /** Message status */
  status: string;

  /** Creation timestamp */
  createdAt: string;

  /** Optional metadata */
  metadata?: Record<string, unknown>;

  /** Reply to message ID */
  replyToMessageId?: string;

  /** Time to live for the record */
  ttl?: number;

  /** Entity type identifier */
  entityType: string;

  /** GSI1 Primary Key - User ID for user's messages */
  GSI1PK?: string;

  /** GSI1 Sort Key - Timestamp for ordering */
  GSI1SK?: string;

  /** GSI2 Primary Key - Message type for filtering */
  GSI2PK?: string;

  /** GSI2 Sort Key - Status and timestamp */
  GSI2SK?: string;
}

/**
 * Query parameters for Message records
 */
export interface MessageQueryDto {
  /** Session ID to query messages for */
  sessionId?: string;

  /** User ID to get user's messages */
  userId?: string;

  /** Message type filter */
  type?: string;

  /** Message status filter */
  status?: string;

  /** Date range for messages */
  createdAfter?: string;
  createdBefore?: string;

  /** Content search (for full-text search) */
  contentContains?: string;

  /** Pagination */
  limit?: number;
  exclusiveStartKey?: Record<string, AttributeValue>;

  /** Sort order */
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Batch operations for messages
 */
export interface BatchMessageWriteDto {
  /** Items to put */
  putItems?: MessageRecordDto[];

  /** Items to delete */
  deleteKeys?: Array<{
    PK: AttributeValue;
    SK: AttributeValue;
  }>;
}

export interface BatchMessageReadDto {
  /** Keys to read */
  keys: Array<{
    PK: AttributeValue;
    SK: AttributeValue;
  }>;

  /** Attributes to project */
  projectionExpression?: string;
}
