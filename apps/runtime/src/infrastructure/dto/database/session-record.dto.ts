import { AttributeValue } from '@aws-sdk/client-dynamodb';

/**
 * DTO for Session records in DynamoDB
 */
export interface SessionRecordDto {
  /** Primary key - Session ID */
  PK: AttributeValue;

  /** Sort key - Entity type */
  SK: AttributeValue;

  /** Session ID */
  sessionId: AttributeValue;

  /** User ID associated with session */
  userId: AttributeValue;

  /** Session status */
  status: AttributeValue;

  /** Session creation timestamp */
  createdAt: AttributeValue;

  /** Last activity timestamp */
  lastActivityAt: AttributeValue;

  /** Session expiration timestamp */
  expiresAt: AttributeValue;

  /** Time to live for the record */
  ttl: AttributeValue;

  /** Maximum duration in minutes */
  maxDurationInMinutes?: AttributeValue;

  /** Optional metadata */
  metadata?: AttributeValue;

  /** Entity type identifier */
  entityType: AttributeValue;

  /** GSI1 Primary Key - User ID for user's sessions */
  GSI1PK?: AttributeValue;

  /** GSI1 Sort Key - Creation timestamp */
  GSI1SK?: AttributeValue;

  /** GSI2 Primary Key - Status for filtering */
  GSI2PK?: AttributeValue;

  /** GSI2 Sort Key - Expiration for cleanup */
  GSI2SK?: AttributeValue;
}

/**
 * Simplified DTO for Session records
 */
export interface SessionRecordPlainDto {
  /** Primary key - Session ID */
  PK: string;

  /** Sort key - Entity type */
  SK: string;

  /** Session ID */
  sessionId: string;

  /** User ID associated with session */
  userId: string;

  /** Session status */
  status: string;

  /** Session creation timestamp */
  createdAt: string;

  /** Last activity timestamp */
  lastActivityAt: string;

  /** Session expiration timestamp */
  expiresAt: string;

  /** Time to live for the record */
  ttl: number;

  /** Maximum duration in minutes */
  maxDurationInMinutes?: number;

  /** Optional metadata */
  metadata?: Record<string, unknown>;

  /** Entity type identifier */
  entityType: string;

  /** GSI1 Primary Key - User ID for user's sessions */
  GSI1PK?: string;

  /** GSI1 Sort Key - Creation timestamp */
  GSI1SK?: string;

  /** GSI2 Primary Key - Status for filtering */
  GSI2PK?: string;

  /** GSI2 Sort Key - Expiration for cleanup */
  GSI2SK?: string;
}

/**
 * Query parameters for Session records
 */
export interface SessionQueryDto {
  /** Session ID to query */
  sessionId?: string;

  /** User ID to get user's sessions */
  userId?: string;

  /** Session status filter */
  status?: string;

  /** Date range for sessions */
  createdAfter?: string;
  createdBefore?: string;

  /** Expiration range for cleanup */
  expiresAfter?: string;
  expiresBefore?: string;

  /** Last activity range */
  lastActivityAfter?: string;
  lastActivityBefore?: string;

  /** Include expired sessions */
  includeExpired?: boolean;

  /** Pagination */
  limit?: number;
  exclusiveStartKey?: Record<string, AttributeValue>;
}

/**
 * Batch operations for sessions
 */
export interface BatchSessionWriteDto {
  /** Items to put */
  putItems?: SessionRecordDto[];

  /** Items to delete */
  deleteKeys?: Array<{
    PK: AttributeValue;
    SK: AttributeValue;
  }>;
}

export interface BatchSessionReadDto {
  /** Keys to read */
  keys: Array<{
    PK: AttributeValue;
    SK: AttributeValue;
  }>;

  /** Attributes to project */
  projectionExpression?: string;
}
