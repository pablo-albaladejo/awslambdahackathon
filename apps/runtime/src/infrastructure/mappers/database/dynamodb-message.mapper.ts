import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { Message, MessageStatus, MessageType } from '@domain/entities/message';
import {
  MessageQueryDto,
  MessageRecordPlainDto,
} from '@infrastructure/dto/database/message-record.dto';
import { DynamoDBQueryMapper } from '@infrastructure/mappers/interfaces/database-mapper.interface';

/**
 * Mapper for Message entity to/from DynamoDB records
 */
export class DynamoDBMessageMapper
  implements
    DynamoDBQueryMapper<Message, MessageRecordPlainDto, MessageQueryDto>
{
  private static readonly ENTITY_TYPE = 'MESSAGE';
  private static readonly PK_PREFIX = 'SESSION#';
  private static readonly SK_PREFIX = 'MSG#';

  /**
   * Maps Message entity to DynamoDB record (plain)
   */
  mapToDto(message: Message): MessageRecordPlainDto {
    const messageId = message.getId().getValue();
    const userId = message.getUserId().getValue();
    const sessionId = message.getSessionId().getValue();
    const createdAt = message.getCreatedAt();

    return {
      PK: `${DynamoDBMessageMapper.PK_PREFIX}${sessionId}`,
      SK: `${DynamoDBMessageMapper.SK_PREFIX}${createdAt.toISOString()}#${messageId}`,
      messageId,
      userId,
      sessionId,
      content: message.getContent(),
      type: message.getType(),
      status: message.getStatus(),
      createdAt: createdAt.toISOString(),
      metadata: message.getMetadata(),
      replyToMessageId: message.getReplyToMessageId()?.getValue(),
      entityType: DynamoDBMessageMapper.ENTITY_TYPE,
      GSI1PK: `USER#${userId}`,
      GSI1SK: `MSG#${createdAt.toISOString()}`,
      GSI2PK: `TYPE#${message.getType()}`,
      GSI2SK: `STATUS#${message.getStatus()}#${createdAt.toISOString()}`,
      ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60, // 90 days TTL
    };
  }

  /**
   * Maps DynamoDB record (plain) to Message entity
   */
  mapToDomain(record: MessageRecordPlainDto): Message {
    return Message.fromData({
      id: record.messageId,
      userId: record.userId,
      sessionId: record.sessionId,
      content: record.content,
      type: record.type as MessageType,
      status: record.status as MessageStatus,
      createdAt: new Date(record.createdAt),
      metadata: record.metadata,
      replyToMessageId: record.replyToMessageId,
    });
  }

  /**
   * Maps array of DTOs to domain entities
   */
  mapArrayToDomain(records: MessageRecordPlainDto[]): Message[] {
    return records.map(record => this.mapToDomain(record));
  }

  /**
   * Maps array of domain entities to DTOs
   */
  mapArrayToDto(messages: Message[]): MessageRecordPlainDto[] {
    return messages.map(message => this.mapToDto(message));
  }

  /**
   * Converts plain record to DynamoDB AttributeValue format
   */
  toAttributeValueRecord(
    record: MessageRecordPlainDto
  ): Record<string, AttributeValue> {
    return marshall(record, {
      removeUndefinedValues: true,
      convertEmptyValues: false,
    });
  }

  /**
   * Converts DynamoDB AttributeValue record to plain format
   */
  fromAttributeValueRecord(
    record: Record<string, AttributeValue>
  ): MessageRecordPlainDto {
    return unmarshall(record) as MessageRecordPlainDto;
  }

  /**
   * Creates DynamoDB key for message
   */
  createKey(
    sessionId: string,
    createdAt: Date,
    messageId: string
  ): Record<string, AttributeValue> {
    return {
      PK: { S: `${DynamoDBMessageMapper.PK_PREFIX}${sessionId}` },
      SK: {
        S: `${DynamoDBMessageMapper.SK_PREFIX}${createdAt.toISOString()}#${messageId}`,
      },
    };
  }

  /**
   * Creates DynamoDB key for message
   */
  createMessageKey(
    sessionId: string,
    createdAt: Date,
    messageId: string
  ): {
    PK: AttributeValue;
    SK: AttributeValue;
  } {
    const key = this.createKey(sessionId, createdAt, messageId);
    return {
      PK: key.PK,
      SK: key.SK,
    };
  }

  /**
   * Validates DynamoDB record structure
   */
  validateRecord(record: MessageRecordPlainDto): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!record.PK || !record.PK.startsWith(DynamoDBMessageMapper.PK_PREFIX)) {
      errors.push('Invalid PK format');
    }

    if (!record.SK || !record.SK.startsWith(DynamoDBMessageMapper.SK_PREFIX)) {
      errors.push('Invalid SK format');
    }

    if (!record.messageId) {
      errors.push('Missing messageId');
    }

    if (!record.userId) {
      errors.push('Missing userId');
    }

    if (!record.sessionId) {
      errors.push('Missing sessionId');
    }

    if (!record.content) {
      errors.push('Missing content');
    }

    if (
      !record.entityType ||
      record.entityType !== DynamoDBMessageMapper.ENTITY_TYPE
    ) {
      errors.push('Invalid entityType');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Maps query DTO to DynamoDB query parameters
   */
  mapQueryToParams(query: MessageQueryDto): {
    KeyConditionExpression?: string;
    FilterExpression?: string;
    ExpressionAttributeNames?: Record<string, string>;
    ExpressionAttributeValues?: Record<string, AttributeValue>;
    IndexName?: string;
  } {
    const params: {
      KeyConditionExpression?: string;
      FilterExpression?: string;
      ExpressionAttributeNames?: Record<string, string>;
      ExpressionAttributeValues?: Record<string, AttributeValue>;
      IndexName?: string;
    } = {};

    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, AttributeValue> = {};
    const filterExpressions: string[] = [];

    // Session-based query (primary key)
    if (query.sessionId) {
      params.KeyConditionExpression = 'PK = :pk';
      expressionAttributeValues[':pk'] = {
        S: `${DynamoDBMessageMapper.PK_PREFIX}${query.sessionId}`,
      };

      // Date range for sort key
      if (query.dateFrom || query.dateTo) {
        if (query.dateFrom && query.dateTo) {
          params.KeyConditionExpression += ' AND SK BETWEEN :skFrom AND :skTo';
          expressionAttributeValues[':skFrom'] = {
            S: `${DynamoDBMessageMapper.SK_PREFIX}${query.dateFrom}`,
          };
          expressionAttributeValues[':skTo'] = {
            S: `${DynamoDBMessageMapper.SK_PREFIX}${query.dateTo}`,
          };
        } else if (query.dateFrom) {
          params.KeyConditionExpression += ' AND SK >= :skFrom';
          expressionAttributeValues[':skFrom'] = {
            S: `${DynamoDBMessageMapper.SK_PREFIX}${query.dateFrom}`,
          };
        } else if (query.dateTo) {
          params.KeyConditionExpression += ' AND SK <= :skTo';
          expressionAttributeValues[':skTo'] = {
            S: `${DynamoDBMessageMapper.SK_PREFIX}${query.dateTo}`,
          };
        }
      }
    }

    // User messages query (GSI1)
    if (query.userId) {
      params.IndexName = 'GSI1';
      params.KeyConditionExpression = 'GSI1PK = :gsi1pk';
      expressionAttributeValues[':gsi1pk'] = { S: `USER#${query.userId}` };
    }

    // Message type query (GSI2)
    if (query.type) {
      params.IndexName = 'GSI2';
      params.KeyConditionExpression = 'GSI2PK = :gsi2pk';
      expressionAttributeValues[':gsi2pk'] = { S: `TYPE#${query.type}` };
    }

    // Filters
    if (query.messageId) {
      filterExpressions.push('#messageId = :messageId');
      expressionAttributeNames['#messageId'] = 'messageId';
      expressionAttributeValues[':messageId'] = { S: query.messageId };
    }

    if (query.status) {
      filterExpressions.push('#status = :status');
      expressionAttributeNames['#status'] = 'status';
      expressionAttributeValues[':status'] = { S: query.status };
    }

    // Set filter expression
    if (filterExpressions.length > 0) {
      params.FilterExpression = filterExpressions.join(' AND ');
    }

    // Set expression attributes if they exist
    if (Object.keys(expressionAttributeNames).length > 0) {
      params.ExpressionAttributeNames = expressionAttributeNames;
    }

    if (Object.keys(expressionAttributeValues).length > 0) {
      params.ExpressionAttributeValues = expressionAttributeValues;
    }

    return params;
  }

  /**
   * Gets table schema information
   */
  getTableSchema(): {
    tableName: string;
    partitionKey: string;
    sortKey: string;
    ttlAttribute: string;
    gsi1: { partitionKey: string; sortKey: string };
    gsi2: { partitionKey: string; sortKey: string };
  } {
    return {
      tableName: process.env.DYNAMODB_TABLE_NAME || 'app-table',
      partitionKey: 'PK',
      sortKey: 'SK',
      gsi1: {
        partitionKey: 'GSI1PK',
        sortKey: 'GSI1SK',
      },
      gsi2: {
        partitionKey: 'GSI2PK',
        sortKey: 'GSI2SK',
      },
      ttlAttribute: 'ttl',
    };
  }
}
