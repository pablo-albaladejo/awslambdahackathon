import { AttributeValue } from '@aws-sdk/client-dynamodb';

/**
 * DTO for User records in DynamoDB
 * Represents the raw DynamoDB item structure
 */
export interface UserRecordDto {
  /** Primary key - User ID */
  PK: AttributeValue;

  /** Sort key - Entity type */
  SK: AttributeValue;

  /** Username */
  username: AttributeValue;

  /** Email address */
  email: AttributeValue;

  /** User groups as a string set */
  groups: AttributeValue;

  /** Whether the user is active */
  isActive: AttributeValue;

  /** Creation timestamp */
  createdAt: AttributeValue;

  /** Last activity timestamp */
  lastActivityAt: AttributeValue;

  /** Time to live for the record */
  ttl?: AttributeValue;

  /** Entity type identifier */
  entityType: AttributeValue;

  /** GSI1 Primary Key for queries */
  GSI1PK?: AttributeValue;

  /** GSI1 Sort Key for queries */
  GSI1SK?: AttributeValue;
}

/**
 * Simplified DTO for User records (without DynamoDB AttributeValue wrapper)
 */
export interface UserRecordPlainDto {
  /** Primary key - User ID */
  PK: string;

  /** Sort key - Entity type */
  SK: string;

  /** Username */
  username: string;

  /** Email address */
  email: string;

  /** User groups */
  groups: string[];

  /** Whether the user is active */
  isActive: boolean;

  /** Creation timestamp */
  createdAt: string;

  /** Last activity timestamp */
  lastActivityAt: string;

  /** Time to live for the record */
  ttl?: number;

  /** Entity type identifier */
  entityType: string;

  /** GSI1 Primary Key for queries */
  GSI1PK?: string;

  /** GSI1 Sort Key for queries */
  GSI1SK?: string;
}

/**
 * Query parameters for User records
 */
export interface UserQueryDto {
  /** User ID to query */
  userId?: string;

  /** Username to search for */
  username?: string;

  /** Email to search for */
  email?: string;

  /** Groups to filter by */
  groups?: string[];

  /** Active status filter */
  isActive?: boolean;

  /** Date range for creation */
  createdAfter?: string;
  createdBefore?: string;

  /** Date range for last activity */
  lastActivityAfter?: string;
  lastActivityBefore?: string;

  /** Pagination */
  limit?: number;
  exclusiveStartKey?: Record<string, AttributeValue>;
}

/**
 * Batch operation DTOs
 */
export interface BatchUserWriteDto {
  /** Items to put */
  putItems?: UserRecordDto[];

  /** Items to delete */
  deleteKeys?: Array<{
    PK: AttributeValue;
    SK: AttributeValue;
  }>;
}

export interface BatchUserReadDto {
  /** Keys to read */
  keys: Array<{
    PK: AttributeValue;
    SK: AttributeValue;
  }>;

  /** Attributes to project */
  projectionExpression?: string;
}
