import { AttributeValue } from '@aws-sdk/client-dynamodb';

import { BidirectionalMapper } from '@/shared/mappers/mapper.interface';

/**
 * Interface for DynamoDB mappers
 */
export interface DynamoDBMapper<TDomain, TRecord>
  extends BidirectionalMapper<TDomain, TRecord> {
  /**
   * Converts plain record to DynamoDB AttributeValue format
   */
  toAttributeValueRecord(record: TRecord): Record<string, AttributeValue>;

  /**
   * Converts DynamoDB AttributeValue record to plain format
   */
  fromAttributeValueRecord(record: Record<string, AttributeValue>): TRecord;

  /**
   * Creates DynamoDB key for the entity
   */
  createKey(...args: unknown[]): Record<string, AttributeValue>;

  /**
   * Validates record structure
   */
  validateRecord(record: TRecord): {
    isValid: boolean;
    errors: string[];
  };

  /**
   * Gets table schema information
   */
  getTableSchema(): {
    tableName: string;
    partitionKey: string;
    sortKey: string;
    ttlAttribute: string;
    [key: string]: unknown;
  };
}

/**
 * Interface for query mappers
 */
export interface QueryMapper<TQuery> {
  /**
   * Maps query DTO to DynamoDB query parameters
   */
  mapQueryToParams(query: TQuery): {
    KeyConditionExpression?: string;
    FilterExpression?: string;
    ExpressionAttributeNames?: Record<string, string>;
    ExpressionAttributeValues?: Record<string, AttributeValue>;
    IndexName?: string;
    [key: string]: unknown;
  };
}

/**
 * Combined interface for DynamoDB mappers with query support
 */
export interface DynamoDBQueryMapper<TDomain, TRecord, TQuery>
  extends DynamoDBMapper<TDomain, TRecord>,
    QueryMapper<TQuery> {}
