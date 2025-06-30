import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { logger } from '@awslambdahackathon/utils/lambda';
import { Message, MessageStatus, MessageType } from '@domain/entities/message';
import { MessageRepository } from '@domain/repositories/message';
import { MessageId, SessionId, UserId } from '@domain/value-objects';

export class DynamoDBMessageRepository implements MessageRepository {
  private readonly ddbClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor() {
    this.ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    this.tableName =
      process.env.WEBSOCKET_MESSAGES_TABLE || 'websocket-messages';
  }

  async findById(id: MessageId): Promise<Message | null> {
    try {
      const result = await this.ddbClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            pk: `MESSAGE#${id.getValue()}`,
            sk: `MESSAGE#${id.getValue()}`,
          },
        })
      );

      if (!result.Item) {
        return null;
      }

      return Message.fromData({
        id: result.Item.messageId,
        content: result.Item.content,
        type: result.Item.type as MessageType,
        userId: result.Item.userId,
        sessionId: result.Item.sessionId,
        status: result.Item.status as MessageStatus,
        createdAt: new Date(result.Item.createdAt),
        metadata: result.Item.metadata || {},
        replyToMessageId: result.Item.replyToMessageId,
      });
    } catch (error) {
      logger.error('Error finding message by ID', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to find message by ID');
    }
  }

  async findBySession(sessionId: SessionId): Promise<Message[]> {
    try {
      const result = await this.ddbClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'sessionId-index',
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

      return result.Items.map(item =>
        Message.fromData({
          id: item.messageId,
          content: item.content,
          type: item.type as MessageType,
          userId: item.userId,
          sessionId: item.sessionId,
          status: item.status as MessageStatus,
          createdAt: new Date(item.createdAt),
          metadata: item.metadata || {},
          replyToMessageId: item.replyToMessageId,
        })
      );
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

      return result.Items.map(item =>
        Message.fromData({
          id: item.messageId,
          content: item.content,
          type: item.type as MessageType,
          userId: item.userId,
          sessionId: item.sessionId,
          status: item.status as MessageStatus,
          createdAt: new Date(item.createdAt),
          metadata: item.metadata || {},
          replyToMessageId: item.replyToMessageId,
        })
      );
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
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'type-index',
          KeyConditionExpression: 'type = :type',
          ExpressionAttributeValues: {
            ':type': type,
          },
          ScanIndexForward: false, // Most recent first
        })
      );

      if (!result.Items) {
        return [];
      }

      return result.Items.map(item =>
        Message.fromData({
          id: item.messageId,
          content: item.content,
          type: item.type as MessageType,
          userId: item.userId,
          sessionId: item.sessionId,
          status: item.status as MessageStatus,
          createdAt: new Date(item.createdAt),
          metadata: item.metadata || {},
          replyToMessageId: item.replyToMessageId,
        })
      );
    } catch (error) {
      logger.error('Error finding messages by type', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to find messages by type');
    }
  }

  async save(message: Message): Promise<void> {
    try {
      await this.ddbClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            pk: `MESSAGE#${message.getId().getValue()}`,
            sk: `MESSAGE#${message.getId().getValue()}`,
            messageId: message.getId().getValue(),
            content: message.getContent(),
            type: message.getType(),
            userId: message.getUserId().getValue(),
            sessionId: message.getSessionId().getValue(),
            status: message.getStatus(),
            createdAt: message.getCreatedAt().toISOString(),
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
      await this.ddbClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            pk: `MESSAGE#${id.getValue()}`,
            sk: `MESSAGE#${id.getValue()}`,
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
      const result = await this.ddbClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            pk: `MESSAGE#${id.getValue()}`,
            sk: `MESSAGE#${id.getValue()}`,
          },
        })
      );

      return !!result.Item;
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

      return result.Items.map(item =>
        Message.fromData({
          id: item.messageId,
          content: item.content,
          type: item.type as MessageType,
          userId: item.userId,
          sessionId: item.sessionId,
          status: item.status as MessageStatus,
          createdAt: new Date(item.createdAt),
          metadata: item.metadata || {},
          replyToMessageId: item.replyToMessageId,
        })
      );
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
          KeyConditionExpression: 'userId = :userId',
          FilterExpression: 'createdAt BETWEEN :startDate AND :endDate',
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

      return result.Items.map(item =>
        Message.fromData({
          id: item.messageId,
          content: item.content,
          type: item.type as MessageType,
          userId: item.userId,
          sessionId: item.sessionId,
          status: item.status as MessageStatus,
          createdAt: new Date(item.createdAt),
          metadata: item.metadata || {},
          replyToMessageId: item.replyToMessageId,
        })
      );
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
          IndexName: 'sessionId-index',
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
}
