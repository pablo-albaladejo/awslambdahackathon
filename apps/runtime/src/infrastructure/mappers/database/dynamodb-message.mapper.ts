import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';

import {
  Message,
  MessageStatus,
  MessageType,
} from '../../../domain/entities/message';
import { BidirectionalMapper } from '../../../shared/mappers/mapper.interface';
import {
  MessageQueryDto,
  MessageRecordPlainDto,
} from '../../dto/database/message-record.dto';

/**
 * Mapper for Message entity to/from DynamoDB records
 */
export class DynamoDBMessageMapper
  implements BidirectionalMapper<Message, MessageRecordPlainDto>
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
   * Maps array of Message entities to DynamoDB records
   */
  mapArrayToDto(messages: Message[]): MessageRecordPlainDto[] {
    return messages.map(message => this.mapToDto(message));
  }

  /**
   * Maps array of DynamoDB records to Message entities
   */
  mapArrayToDomain(records: MessageRecordPlainDto[]): Message[] {
    return records.map(record => this.mapToDomain(record));
  }

  /**
   * Maps Message entity to DynamoDB AttributeValue record
   */
  toAttributeValueRecord(message: Message): Record<string, AttributeValue> {
    const plainRecord = this.mapToDto(message);
    return marshall(plainRecord, {
      convertEmptyValues: false,
      removeUndefinedValues: true,
    });
  }

  /**
   * Maps DynamoDB AttributeValue record to Message entity
   */
  fromAttributeValueRecord(record: Record<string, AttributeValue>): Message {
    const plainRecord = unmarshall(record) as MessageRecordPlainDto;
    return this.mapToDomain(plainRecord);
  }

  /**
   * Creates DynamoDB key for message lookup
   */
  createMessageKey(
    sessionId: string,
    messageId: string,
    createdAt: Date
  ): { PK: string; SK: string } {
    return {
      PK: `${DynamoDBMessageMapper.PK_PREFIX}${sessionId}`,
      SK: `${DynamoDBMessageMapper.SK_PREFIX}${createdAt.toISOString()}#${messageId}`,
    };
  }

  /**
   * Creates DynamoDB key with AttributeValues
   */
  createMessageKeyAttributeValues(
    sessionId: string,
    messageId: string,
    createdAt: Date
  ): { PK: AttributeValue; SK: AttributeValue } {
    const key = this.createMessageKey(sessionId, messageId, createdAt);
    return {
      PK: { S: key.PK },
      SK: { S: key.SK },
    };
  }

  /**
   * Creates session key for querying all messages in a session
   */
  createSessionKey(sessionId: string): { PK: string } {
    return {
      PK: `${DynamoDBMessageMapper.PK_PREFIX}${sessionId}`,
    };
  }

  /**
   * Creates GSI1 key for user's messages lookup
   */
  createUserMessagesKey(userId: string): { GSI1PK: string } {
    return {
      GSI1PK: `USER#${userId}`,
    };
  }

  /**
   * Maps MessageQueryDto to DynamoDB query parameters
   */
  mapQueryToParams(query: MessageQueryDto): Record<string, unknown> {
    const params: Record<string, unknown> = {};

    if (query.sessionId) {
      params.KeyConditionExpression = 'PK = :pk';
      params.ExpressionAttributeValues = {
        ':pk': { S: `${DynamoDBMessageMapper.PK_PREFIX}${query.sessionId}` },
      };

      // Add SK condition for date range
      if (query.createdAfter || query.createdBefore) {
        if (query.createdAfter && query.createdBefore) {
          params.KeyConditionExpression +=
            ' AND SK BETWEEN :skStart AND :skEnd';
          (params.ExpressionAttributeValues as Record<string, AttributeValue>)[
            ':skStart'
          ] = {
            S: `${DynamoDBMessageMapper.SK_PREFIX}${query.createdAfter}`,
          };
          (params.ExpressionAttributeValues as Record<string, AttributeValue>)[
            ':skEnd'
          ] = {
            S: `${DynamoDBMessageMapper.SK_PREFIX}${query.createdBefore}`,
          };
        } else if (query.createdAfter) {
          params.KeyConditionExpression += ' AND SK >= :skStart';
          (params.ExpressionAttributeValues as Record<string, AttributeValue>)[
            ':skStart'
          ] = {
            S: `${DynamoDBMessageMapper.SK_PREFIX}${query.createdAfter}`,
          };
        } else if (query.createdBefore) {
          params.KeyConditionExpression += ' AND SK <= :skEnd';
          (params.ExpressionAttributeValues as Record<string, AttributeValue>)[
            ':skEnd'
          ] = {
            S: `${DynamoDBMessageMapper.SK_PREFIX}${query.createdBefore}`,
          };
        }
      }
    } else if (query.userId) {
      params.IndexName = 'GSI1';
      params.KeyConditionExpression = 'GSI1PK = :gsi1pk';
      params.ExpressionAttributeValues = {
        ':gsi1pk': { S: `USER#${query.userId}` },
      };
    } else if (query.type) {
      params.IndexName = 'GSI2';
      params.KeyConditionExpression = 'GSI2PK = :gsi2pk';
      params.ExpressionAttributeValues = {
        ':gsi2pk': { S: `TYPE#${query.type}` },
      };
    }

    // Add filter expressions
    const filterExpressions: string[] = [];
    const expressionAttributeValues: Record<string, AttributeValue> =
      (params.ExpressionAttributeValues as Record<string, AttributeValue>) ||
      {};

    if (query.status) {
      filterExpressions.push('#status = :status');
      expressionAttributeValues[':status'] = { S: query.status };
      params.ExpressionAttributeNames = { '#status': 'status' };
    }

    if (query.contentContains) {
      filterExpressions.push('contains(content, :content)');
      expressionAttributeValues[':content'] = { S: query.contentContains };
    }

    if (filterExpressions.length > 0) {
      params.FilterExpression = filterExpressions.join(' AND ');
    }

    params.ExpressionAttributeValues = expressionAttributeValues;

    if (query.limit) {
      params.Limit = query.limit;
    }

    if (query.exclusiveStartKey) {
      params.ExclusiveStartKey = query.exclusiveStartKey;
    }

    if (query.sortOrder === 'DESC') {
      params.ScanIndexForward = false;
    }

    return params;
  }

  /**
   * Extracts session ID from DynamoDB PK
   */
  private extractSessionIdFromPK(pk: string): string {
    return pk.replace(DynamoDBMessageMapper.PK_PREFIX, '');
  }

  /**
   * Extracts message ID from DynamoDB SK
   */
  private extractMessageIdFromSK(sk: string): string {
    const parts = sk.replace(DynamoDBMessageMapper.SK_PREFIX, '').split('#');
    return parts[1] || '';
  }

  /**
   * Validates that a record is a valid message record
   */
  isValidMessageRecord(record: Record<string, AttributeValue>): boolean {
    try {
      const unmarshalled = unmarshall(record) as MessageRecordPlainDto;
      return (
        unmarshalled.entityType === DynamoDBMessageMapper.ENTITY_TYPE &&
        unmarshalled.PK?.startsWith(DynamoDBMessageMapper.PK_PREFIX) &&
        unmarshalled.SK?.startsWith(DynamoDBMessageMapper.SK_PREFIX) &&
        typeof unmarshalled.messageId === 'string' &&
        typeof unmarshalled.userId === 'string' &&
        typeof unmarshalled.sessionId === 'string' &&
        typeof unmarshalled.content === 'string' &&
        typeof unmarshalled.type === 'string' &&
        typeof unmarshalled.status === 'string'
      );
    } catch {
      return false;
    }
  }
}
