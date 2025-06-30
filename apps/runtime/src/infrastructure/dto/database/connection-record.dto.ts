import { AttributeValue } from '@aws-sdk/client-dynamodb';

/**
 * DTO for Connection records in DynamoDB
 */
export interface ConnectionRecordDto {
  /** Primary key - Connection ID */
  PK: AttributeValue;

  /** Sort key - Entity type */
  SK: AttributeValue;

  /** Connection ID */
  connectionId: AttributeValue;

  /** User ID associated with connection */
  userId?: AttributeValue;

  /** Connection status */
  status: AttributeValue;

  /** Connection timestamp */
  connectedAt: AttributeValue;

  /** Last activity timestamp */
  lastActivityAt: AttributeValue;

  /** Time to live for the record */
  ttl: AttributeValue;

  /** Optional metadata */
  metadata?: AttributeValue;

  /** Entity type identifier */
  entityType: AttributeValue;

  /** GSI1 Primary Key - User ID for user's connections */
  GSI1PK?: AttributeValue;

  /** GSI1 Sort Key - Connection timestamp */
  GSI1SK?: AttributeValue;

  /** GSI2 Primary Key - Status for filtering */
  GSI2PK?: AttributeValue;

  /** GSI2 Sort Key - Last activity for cleanup */
  GSI2SK?: AttributeValue;
}

/**
 * Simplified DTO for Connection records
 */
export interface ConnectionRecordPlainDto {
  /** Primary key - Connection ID */
  PK: string;

  /** Sort key - Entity type */
  SK: string;

  /** Connection ID */
  connectionId: string;

  /** User ID associated with connection */
  userId?: string;

  /** Connection status */
  status: string;

  /** Connection timestamp */
  connectedAt: string;

  /** Last activity timestamp */
  lastActivityAt: string;

  /** Time to live for the record */
  ttl: number;

  /** Optional metadata */
  metadata?: Record<string, unknown>;

  /** Entity type identifier */
  entityType: string;

  /** GSI1 Primary Key - User ID for user's connections */
  GSI1PK?: string;

  /** GSI1 Sort Key - Connection timestamp */
  GSI1SK?: string;

  /** GSI2 Primary Key - Status for filtering */
  GSI2PK?: string;

  /** GSI2 Sort Key - Last activity for cleanup */
  GSI2SK?: string;
}

/**
 * Query parameters for Connection records
 */
export interface ConnectionQueryDto {
  /** Connection ID to query */
  connectionId?: string;

  /** User ID to get user's connections */
  userId?: string;

  /** Connection status filter */
  status?: string;

  /** Date range for connections */
  connectedAfter?: string;
  connectedBefore?: string;

  /** Last activity range for cleanup */
  lastActivityAfter?: string;
  lastActivityBefore?: string;

  /** Include expired connections */
  includeExpired?: boolean;

  /** Pagination */
  limit?: number;
  exclusiveStartKey?: Record<string, AttributeValue>;
}

/**
 * Batch operations for connections
 */
export interface BatchConnectionWriteDto {
  /** Items to put */
  putItems?: ConnectionRecordDto[];

  /** Items to delete */
  deleteKeys?: Array<{
    PK: AttributeValue;
    SK: AttributeValue;
  }>;
}

export interface BatchConnectionReadDto {
  /** Keys to read */
  keys: Array<{
    PK: AttributeValue;
    SK: AttributeValue;
  }>;

  /** Attributes to project */
  projectionExpression?: string;
}
