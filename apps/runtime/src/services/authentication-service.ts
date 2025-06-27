import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { logger } from '@awslambdahackathon/utils/lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

export interface AuthenticatedUser {
  userId: string;
  username: string;
  email: string;
  groups?: string[];
}

export interface AuthenticationResult {
  success: boolean;
  user?: AuthenticatedUser;
  error?: string;
}

export interface AuthenticatedConnection {
  connectionId: string;
  user: AuthenticatedUser;
  isAuthenticated: boolean;
  authenticatedAt: number;
  ttl: number;
}

export class AuthenticationService {
  private readonly verifier: ReturnType<typeof CognitoJwtVerifier.create>;
  private readonly ddbClient: DynamoDBDocumentClient;
  private readonly tableName: string;

  constructor() {
    // Validate required environment variables
    const userPoolId = process.env.COGNITO_USER_POOL_ID;
    const clientId = process.env.COGNITO_CLIENT_ID;
    const tableName = process.env.WEBSOCKET_CONNECTIONS_TABLE;

    if (!userPoolId) {
      throw new Error('COGNITO_USER_POOL_ID environment variable is required');
    }
    if (!clientId) {
      throw new Error('COGNITO_CLIENT_ID environment variable is required');
    }
    if (!tableName) {
      throw new Error(
        'WEBSOCKET_CONNECTIONS_TABLE environment variable is required'
      );
    }

    this.verifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: 'access',
      clientId,
    });

    this.ddbClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    this.tableName = tableName;
  }

  /**
   * Authenticate a user with JWT token
   */
  async authenticateUser(token: string): Promise<AuthenticationResult> {
    try {
      logger.info('Starting authentication process', {
        tokenLength: token?.length,
        hasToken: !!token,
      });

      if (!token) {
        logger.warn('Authentication failed: Missing token');
        return {
          success: false,
          error: 'Missing authentication token',
        };
      }

      logger.info('Verifying JWT token', {
        userPoolId: process.env.COGNITO_USER_POOL_ID,
        clientId: process.env.COGNITO_CLIENT_ID,
      });

      const payload = await this.verifier.verify(token);

      logger.info('JWT token verified successfully', {
        sub: payload.sub,
        username: payload.username,
        email: payload.email,
        exp: payload.exp,
      });

      // Verify token expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        logger.warn('Authentication failed: Token expired', {
          exp: payload.exp,
          now,
        });
        return {
          success: false,
          error: 'Token expired',
        };
      }

      const user: AuthenticatedUser = {
        userId: payload.sub,
        username: (payload.username as string) || payload.sub,
        email: (payload.email as string) || '',
        groups: (payload['cognito:groups'] as string[]) || [],
      };

      logger.info('User authenticated successfully', {
        userId: user.userId,
        username: user.username,
        email: user.email,
        groups: user.groups,
      });

      return {
        success: true,
        user,
      };
    } catch (error) {
      logger.error('Authentication failed', {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        error: 'Invalid authentication token',
      };
    }
  }

  /**
   * Store authenticated connection in DynamoDB
   */
  async storeAuthenticatedConnection(
    connectionId: string,
    user: AuthenticatedUser
  ): Promise<void> {
    const now = Date.now();
    const ttl = Math.floor(now / 1000) + 24 * 60 * 60; // 24 hours TTL

    try {
      await this.ddbClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            connectionId,
            userId: user.userId,
            username: user.username,
            email: user.email,
            groups: user.groups,
            isAuthenticated: true,
            authenticatedAt: now,
            ttl,
          },
        })
      );

      logger.info('Authenticated connection stored in DynamoDB', {
        connectionId,
        userId: user.userId,
        ttl,
      });
    } catch (error) {
      logger.error('Failed to store authenticated connection', {
        connectionId,
        userId: user.userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get authenticated connection from DynamoDB
   */
  async getAuthenticatedConnection(
    connectionId: string
  ): Promise<AuthenticatedConnection | undefined> {
    try {
      const result = await this.ddbClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { connectionId },
        })
      );

      if (!result.Item) {
        return undefined;
      }

      const item = result.Item;
      const connection: AuthenticatedConnection = {
        connectionId: item.connectionId,
        user: {
          userId: item.userId,
          username: item.username,
          email: item.email,
          groups: item.groups,
        },
        isAuthenticated: item.isAuthenticated,
        authenticatedAt: item.authenticatedAt,
        ttl: item.ttl,
      };

      // Check if connection has expired
      const now = Math.floor(Date.now() / 1000);
      if (connection.ttl && connection.ttl < now) {
        logger.info('Connection expired, removing from database', {
          connectionId,
          ttl: connection.ttl,
          now,
        });
        await this.removeAuthenticatedConnection(connectionId);
        return undefined;
      }

      return connection;
    } catch (error) {
      logger.error('Failed to get authenticated connection', {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  /**
   * Check if connection is authenticated
   */
  async isConnectionAuthenticated(connectionId: string): Promise<boolean> {
    const connection = await this.getAuthenticatedConnection(connectionId);
    return connection?.isAuthenticated || false;
  }

  /**
   * Remove authenticated connection from DynamoDB
   */
  async removeAuthenticatedConnection(connectionId: string): Promise<void> {
    try {
      await this.ddbClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { connectionId },
        })
      );

      logger.info('Authenticated connection removed from DynamoDB', {
        connectionId,
      });
    } catch (error) {
      logger.error('Failed to remove authenticated connection', {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get user from authenticated connection
   */
  async getUserFromConnection(
    connectionId: string
  ): Promise<AuthenticatedUser | undefined> {
    const connection = await this.getAuthenticatedConnection(connectionId);
    return connection?.user;
  }

  /**
   * Check if user has required group
   */
  async hasUserGroup(
    connectionId: string,
    requiredGroup: string
  ): Promise<boolean> {
    const user = await this.getUserFromConnection(connectionId);
    return user?.groups?.includes(requiredGroup) || false;
  }

  /**
   * Clean up expired connections using DynamoDB TTL
   * Note: DynamoDB automatically deletes items when TTL expires
   * This method is for manual cleanup if needed
   */
  async cleanupExpiredConnections(): Promise<void> {
    try {
      const now = Math.floor(Date.now() / 1000);

      // Query for expired connections
      const result = await this.ddbClient.send(
        new QueryCommand({
          TableName: this.tableName,
          FilterExpression: 'ttl < :now',
          ExpressionAttributeValues: {
            ':now': now,
          },
        })
      );

      if (result.Items && result.Items.length > 0) {
        logger.info('Found expired connections for cleanup', {
          count: result.Items.length,
        });

        // Delete expired connections
        const deletePromises = result.Items.map(item =>
          this.ddbClient.send(
            new DeleteCommand({
              TableName: this.tableName,
              Key: { connectionId: item.connectionId },
            })
          )
        );

        await Promise.all(deletePromises);

        logger.info('Cleaned up expired connections', {
          count: result.Items.length,
        });
      }
    } catch (error) {
      logger.error('Failed to cleanup expired connections', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

// Singleton instance
export const authenticationService = new AuthenticationService();
