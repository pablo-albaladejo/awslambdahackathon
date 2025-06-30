import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { logger } from '@awslambdahackathon/utils/lambda';
import { Message, MessageStatus, MessageType } from '@domain/entities/message';
import { MessageRepository } from '@domain/repositories/message';
import { MessageId, SessionId, UserId } from '@domain/value-objects';
import { DynamoDBConfig } from '@infrastructure/config/database-config';

export class DynamoDBMessageRepository implements MessageRepository {
  private readonly ddbClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(ddbClient: DynamoDBDocumentClient, config: DynamoDBConfig) {
    this.ddbClient = ddbClient;
    this.tableName = config.tableName;
  }

  async findById(id: MessageId): Promise<Message | null> {
    try {
      const result = await this.ddbClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: 'messageId = :messageId',
          ExpressionAttributeValues: {
            ':messageId': id.getValue(),
          },
        })
      );

      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      return this.mapToMessage(result.Items[0]);
    } catch (error) {
      logger.error('Error finding message by ID', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to find message');
    }
  }

  async findBySession(sessionId: SessionId): Promise<Message[]> {
    try {
      const result = await this.ddbClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'sessionId = :sessionId',
          ExpressionAttributeValues: {
            ':sessionId': sessionId.getValue(),
          },
          ScanIndexForward: false, // Most recent first
        })
      );

      if (!result.Items) {
        return [];
      }

      return result.Items.map(item => this.mapToMessage(item));
    } catch (error) {
      logger.error('Error finding messages by session', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to find messages by session');
    }
  }

  async findByUser(userId: UserId): Promise<Message[]> {
    try {
      const result = await this.ddbClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'userId-index',
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId.getValue(),
          },
          ScanIndexForward: false, // Most recent first
        })
      );

      if (!result.Items) {
        return [];
      }

      return result.Items.map(item => this.mapToMessage(item));
    } catch (error) {
      logger.error('Error finding messages by user', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to find messages by user');
    }
  }

  async findByType(type: MessageType): Promise<Message[]> {
    try {
      const result = await this.ddbClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: '#type = :type',
          ExpressionAttributeNames: {
            '#type': 'type',
          },
          ExpressionAttributeValues: {
            ':type': type,
          },
        })
      );

      if (!result.Items) {
        return [];
      }

      return result.Items.map(item => this.mapToMessage(item));
    } catch (error) {
      logger.error('Error finding messages by type', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to find messages by type');
    }
  }

  async save(message: Message): Promise<void> {
    try {
      const timestamp = message.getCreatedAt().toISOString();
      await this.ddbClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            sessionId: message.getSessionId().getValue(),
            timestamp: timestamp,
            messageId: message.getId().getValue(),
            content: message.getContent(),
            type: message.getType(),
            userId: message.getUserId().getValue(),
            status: message.getStatus(),
            createdAt: timestamp,
            metadata: message.getMetadata(),
            replyToMessageId: message.getReplyToMessageId()?.getValue(),
            ttl: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hours
          },
        })
      );
    } catch (error) {
      logger.error('Error saving message', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to save message');
    }
  }

  async delete(id: MessageId): Promise<void> {
    try {
      const message = await this.findById(id);
      if (!message) {
        throw new Error('Message not found');
      }

      await this.ddbClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            sessionId: message.getSessionId().getValue(),
            timestamp: message.getCreatedAt().toISOString(),
          },
        })
      );
    } catch (error) {
      logger.error('Error deleting message', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to delete message');
    }
  }

  async exists(id: MessageId): Promise<boolean> {
    try {
      const message = await this.findById(id);
      return message !== null;
    } catch (error) {
      logger.error('Error checking if message exists', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to check if message exists');
    }
  }

  async findRecentMessages(userId: UserId, limit: number): Promise<Message[]> {
    try {
      const result = await this.ddbClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'userId-index',
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId.getValue(),
          },
          ScanIndexForward: false, // Most recent first
          Limit: limit,
        })
      );

      if (!result.Items) {
        return [];
      }

      return result.Items.map(item => this.mapToMessage(item));
    } catch (error) {
      logger.error('Error finding recent messages', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to find recent messages');
    }
  }

  async findMessagesByDateRange(
    userId: UserId,
    startDate: Date,
    endDate: Date
  ): Promise<Message[]> {
    try {
      const result = await this.ddbClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'userId-index',
          KeyConditionExpression:
            'userId = :userId AND #timestamp BETWEEN :startDate AND :endDate',
          ExpressionAttributeNames: {
            '#timestamp': 'timestamp',
          },
          ExpressionAttributeValues: {
            ':userId': userId.getValue(),
            ':startDate': startDate.toISOString(),
            ':endDate': endDate.toISOString(),
          },
          ScanIndexForward: false, // Most recent first
        })
      );

      if (!result.Items) {
        return [];
      }

      return result.Items.map(item => this.mapToMessage(item));
    } catch (error) {
      logger.error('Error finding messages by date range', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to find messages by date range');
    }
  }

  async countByUser(userId: UserId): Promise<number> {
    try {
      const result = await this.ddbClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'userId-index',
          KeyConditionExpression: 'userId = :userId',
          ExpressionAttributeValues: {
            ':userId': userId.getValue(),
          },
          Select: 'COUNT',
        })
      );

      return result.Count || 0;
    } catch (error) {
      logger.error('Error counting messages by user', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to count messages by user');
    }
  }

  async countBySession(sessionId: SessionId): Promise<number> {
    try {
      const result = await this.ddbClient.send(
        new QueryCommand({
          TableName: this.tableName,
          KeyConditionExpression: 'sessionId = :sessionId',
          ExpressionAttributeValues: {
            ':sessionId': sessionId.getValue(),
          },
          Select: 'COUNT',
        })
      );

      return result.Count || 0;
    } catch (error) {
      logger.error('Error counting messages by session', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to count messages by session');
    }
  }

  private mapToMessage(item: Record<string, unknown>): Message {
    // Safe type conversion with validation
    const safeString = (value: unknown): string => {
      if (typeof value === 'string') return value;
      throw new Error(`Expected string, got ${typeof value}`);
    };

    const safeMessageType = (value: unknown): MessageType => {
      if (
        typeof value === 'string' &&
        ['text', 'system', 'notification'].includes(value)
      ) {
        return value as MessageType;
      }
      throw new Error(`Invalid MessageType: ${value}`);
    };

    const safeMessageStatus = (value: unknown): MessageStatus => {
      if (
        typeof value === 'string' &&
        ['sent', 'delivered', 'read', 'failed'].includes(value)
      ) {
        return value as MessageStatus;
      }
      throw new Error(`Invalid MessageStatus: ${value}`);
    };

    return Message.fromData({
      id: safeString(item.messageId),
      content: safeString(item.content),
      type: safeMessageType(item.type),
      userId: safeString(item.userId),
      sessionId: safeString(item.sessionId),
      status: safeMessageStatus(item.status),
      createdAt: new Date(safeString(item.createdAt || item.timestamp)),
      metadata: (item.metadata as Record<string, unknown>) || {},
      replyToMessageId: item.replyToMessageId
        ? safeString(item.replyToMessageId)
        : undefined,
    });
  }
}
