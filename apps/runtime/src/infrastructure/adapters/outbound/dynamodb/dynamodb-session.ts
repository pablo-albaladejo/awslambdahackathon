import { DynamoDBClient, DynamoDBClientConfig } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { logger } from '@awslambdahackathon/utils/lambda';
import { DynamoDBConfig } from '@config/container';
import { Session, SessionStatus } from '@domain/entities/session';
import { SessionRepository } from '@domain/repositories/session';
import { SessionId, UserId } from '@domain/value-objects';

export class DynamoDBSessionRepository implements SessionRepository {
  private readonly ddbClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor(config: DynamoDBConfig) {
    const clientConfig: DynamoDBClientConfig = { region: config.region };
    if (config.endpoint) {
      clientConfig.endpoint = config.endpoint;
    }

    this.ddbClient = DynamoDBDocumentClient.from(
      new DynamoDBClient(clientConfig)
    );
    this.tableName = config.tableName;
  }

  async findById(id: SessionId): Promise<Session | null> {
    try {
      const result = await this.ddbClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            pk: `SESSION#${id.getValue()}`,
            sk: `SESSION#${id.getValue()}`,
          },
        })
      );

      if (!result.Item) {
        return null;
      }

      return this.mapToSession(result.Item);
    } catch (error) {
      logger.error('Error finding session by ID', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to find session by ID');
    }
  }

  async findByUser(userId: UserId): Promise<Session[]> {
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

      return result.Items.map(item => this.mapToSession(item));
    } catch (error) {
      logger.error('Error finding sessions by user', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to find sessions by user');
    }
  }

  async findByUserId(userId: UserId): Promise<Session[]> {
    return this.findByUser(userId);
  }

  async findByStatus(status: SessionStatus): Promise<Session[]> {
    try {
      const result = await this.ddbClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: 'status = :status',
          ExpressionAttributeValues: {
            ':status': status,
          },
        })
      );

      if (!result.Items) {
        return [];
      }

      return result.Items.map(item => this.mapToSession(item));
    } catch (error) {
      logger.error('Error finding sessions by status', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to find sessions by status');
    }
  }

  async findActiveByUser(userId: UserId): Promise<Session[]> {
    try {
      const result = await this.ddbClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'userId-index',
          KeyConditionExpression: 'userId = :userId',
          FilterExpression: 'status = :status',
          ExpressionAttributeValues: {
            ':userId': userId.getValue(),
            ':status': SessionStatus.ACTIVE,
          },
          ScanIndexForward: false, // Most recent first
        })
      );

      if (!result.Items) {
        return [];
      }

      return result.Items.map(item => this.mapToSession(item)).filter(session =>
        session.isActive()
      ); // Additional filter for expired sessions
    } catch (error) {
      logger.error('Error finding active sessions by user', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to find active sessions by user');
    }
  }

  async findExpiredSessions(): Promise<Session[]> {
    try {
      const now = new Date().toISOString();
      const result = await this.ddbClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: 'expiresAt < :now',
          ExpressionAttributeValues: {
            ':now': now,
          },
        })
      );

      if (!result.Items) {
        return [];
      }

      return result.Items.map(item => this.mapToSession(item));
    } catch (error) {
      logger.error('Error finding expired sessions', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to find expired sessions');
    }
  }

  async save(session: Session): Promise<void> {
    try {
      await this.ddbClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            pk: `SESSION#${session.getId().getValue()}`,
            sk: `SESSION#${session.getId().getValue()}`,
            sessionId: session.getId().getValue(),
            userId: session.getUserId().getValue(),
            status: session.getStatus(),
            createdAt: session.getCreatedAt().toISOString(),
            lastActivityAt: session.getLastActivityAt()?.toISOString(),
            expiresAt: session.getExpiresAt()?.toISOString(),
            metadata: session.getMetadata(),
            maxDurationInMinutes: session.getMaxDurationInMinutes(),
            ttl: session.getExpiresAt()
              ? Math.floor((session.getExpiresAt() as Date).getTime() / 1000)
              : Math.floor(Date.now() / 1000) + 86400, // Default 24 hours
          },
        })
      );
    } catch (error) {
      logger.error('Error saving session', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to save session');
    }
  }

  async delete(id: SessionId): Promise<void> {
    try {
      await this.ddbClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: {
            pk: `SESSION#${id.getValue()}`,
            sk: `SESSION#${id.getValue()}`,
          },
        })
      );
    } catch (error) {
      logger.error('Error deleting session', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to delete session');
    }
  }

  async exists(id: SessionId): Promise<boolean> {
    try {
      const result = await this.ddbClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: {
            pk: `SESSION#${id.getValue()}`,
            sk: `SESSION#${id.getValue()}`,
          },
        })
      );

      return !!result.Item;
    } catch (error) {
      logger.error('Error checking if session exists', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to check if session exists');
    }
  }

  async updateActivity(id: SessionId): Promise<void> {
    try {
      await this.ddbClient.send(
        new UpdateCommand({
          TableName: this.tableName,
          Key: {
            pk: `SESSION#${id.getValue()}`,
            sk: `SESSION#${id.getValue()}`,
          },
          UpdateExpression: 'SET lastActivityAt = :lastActivityAt',
          ExpressionAttributeValues: {
            ':lastActivityAt': new Date().toISOString(),
          },
        })
      );
    } catch (error) {
      logger.error('Error updating session activity', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to update session activity');
    }
  }

  async extendSession(id: SessionId, durationInMinutes: number): Promise<void> {
    try {
      const session = await this.findById(id);
      if (!session) {
        throw new Error('Session not found');
      }

      const extendedSession = session.extend(durationInMinutes);
      await this.save(extendedSession);
    } catch (error) {
      logger.error('Error extending session', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to extend session');
    }
  }

  async deactivateSession(id: SessionId): Promise<void> {
    try {
      const session = await this.findById(id);
      if (!session) {
        throw new Error('Session not found');
      }

      const deactivatedSession = session.deactivate();
      await this.save(deactivatedSession);
    } catch (error) {
      logger.error('Error deactivating session', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to deactivate session');
    }
  }

  async suspendSession(id: SessionId): Promise<void> {
    try {
      const session = await this.findById(id);
      if (!session) {
        throw new Error('Session not found');
      }

      const suspendedSession = session.suspend();
      await this.save(suspendedSession);
    } catch (error) {
      logger.error('Error suspending session', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to suspend session');
    }
  }

  async reactivateSession(id: SessionId): Promise<void> {
    try {
      const session = await this.findById(id);
      if (!session) {
        throw new Error('Session not found');
      }

      const reactivatedSession = session.reactivate();
      await this.save(reactivatedSession);
    } catch (error) {
      logger.error('Error reactivating session', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to reactivate session');
    }
  }

  async findInactiveSessions(maxInactiveMinutes: number): Promise<Session[]> {
    try {
      const cutoffTime = new Date(
        Date.now() - maxInactiveMinutes * 60 * 1000
      ).toISOString();
      const result = await this.ddbClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: 'lastActivityAt < :cutoffTime AND status = :status',
          ExpressionAttributeValues: {
            ':cutoffTime': cutoffTime,
            ':status': SessionStatus.ACTIVE,
          },
        })
      );

      if (!result.Items) {
        return [];
      }

      return result.Items.map(item => this.mapToSession(item));
    } catch (error) {
      logger.error('Error finding inactive sessions', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to find inactive sessions');
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
      logger.error('Error counting sessions by user', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to count sessions by user');
    }
  }

  async countActiveByUser(userId: UserId): Promise<number> {
    try {
      const result = await this.ddbClient.send(
        new QueryCommand({
          TableName: this.tableName,
          IndexName: 'userId-index',
          KeyConditionExpression: 'userId = :userId',
          FilterExpression: 'status = :status',
          ExpressionAttributeValues: {
            ':userId': userId.getValue(),
            ':status': SessionStatus.ACTIVE,
          },
          Select: 'COUNT',
        })
      );

      return result.Count || 0;
    } catch (error) {
      logger.error('Error counting active sessions by user', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to count active sessions by user');
    }
  }

  async deleteExpiredSessions(): Promise<void> {
    try {
      const expiredSessions = await this.findExpiredSessions();

      for (const session of expiredSessions) {
        await this.delete(session.getId());
      }
    } catch (error) {
      logger.error('Error deleting expired sessions', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to delete expired sessions');
    }
  }

  async findActiveSessionByUser(userId: UserId): Promise<Session | null> {
    try {
      const activeSessions = await this.findActiveByUser(userId);
      return activeSessions.length > 0 ? activeSessions[0] : null;
    } catch (error) {
      logger.error('Error finding active session by user', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to find active session by user');
    }
  }

  async countByStatus(status: SessionStatus): Promise<number> {
    try {
      const result = await this.ddbClient.send(
        new ScanCommand({
          TableName: this.tableName,
          FilterExpression: 'status = :status',
          ExpressionAttributeValues: {
            ':status': status,
          },
          Select: 'COUNT',
        })
      );

      return result.Count || 0;
    } catch (error) {
      logger.error('Error counting sessions by status', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to count sessions by status');
    }
  }

  private mapToSession(item: Record<string, unknown>): Session {
    // Safe type conversion with validation
    const safeString = (value: unknown): string => {
      if (typeof value === 'string') return value;
      throw new Error(`Expected string, got ${typeof value}`);
    };

    const safeSessionStatus = (value: unknown): SessionStatus => {
      if (
        typeof value === 'string' &&
        ['active', 'inactive', 'expired'].includes(value)
      ) {
        return value as SessionStatus;
      }
      throw new Error(`Invalid SessionStatus: ${value}`);
    };

    return Session.fromData({
      id: safeString(item.sessionId || item.id),
      userId: safeString(item.userId),
      status: safeSessionStatus(item.status),
      createdAt: new Date(safeString(item.createdAt)),
      lastActivityAt: item.lastActivityAt
        ? new Date(safeString(item.lastActivityAt))
        : undefined,
      expiresAt: new Date(safeString(item.expiresAt)), // expiresAt is required
      metadata: (item.metadata as Record<string, unknown>) || {},
      maxDurationInMinutes:
        typeof item.maxDurationInMinutes === 'number'
          ? item.maxDurationInMinutes
          : undefined,
    });
  }
}
