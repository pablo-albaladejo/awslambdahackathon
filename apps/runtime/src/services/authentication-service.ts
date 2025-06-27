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

import { container } from '../config/container';

import { circuitBreakerService } from './circuit-breaker-service';
import { metricsService } from './metrics-service';

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
    const startTime = Date.now();
    let success = false;
    let errorType: string | undefined;

    // Start performance monitoring for authentication
    const performanceMonitor = container
      .getPerformanceMonitoringService()
      .startMonitoring('authentication_jwt_verification', {
        tokenLength: token?.length,
        hasToken: !!token,
        correlationId: this.generateCorrelationId(),
        operation: 'authentication_jwt_verification',
        service: 'authentication',
      });

    try {
      logger.info('Starting authentication process', {
        tokenLength: token?.length,
        hasToken: !!token,
        correlationId: this.generateCorrelationId(),
      });

      if (!token) {
        errorType = 'MISSING_TOKEN';
        logger.warn('Authentication failed: Missing token', {
          correlationId: this.generateCorrelationId(),
        });

        performanceMonitor.complete(false, {
          error: 'MISSING_TOKEN',
          errorType,
        });

        return {
          success: false,
          error: 'Missing authentication token',
        };
      }

      logger.info('Verifying JWT token', {
        userPoolId: process.env.COGNITO_USER_POOL_ID,
        clientId: process.env.COGNITO_CLIENT_ID,
        correlationId: this.generateCorrelationId(),
      });

      // Use circuit breaker for Cognito JWT verification
      const payload = await circuitBreakerService.execute(
        'cognito',
        'verifyJWT',
        async () => {
          return await this.verifier.verify(token);
        },
        async () => {
          // Fallback behavior when Cognito is unavailable
          logger.warn(
            'Cognito service unavailable, using fallback authentication',
            {
              correlationId: this.generateCorrelationId(),
            }
          );
          throw new Error('Authentication service temporarily unavailable');
        },
        {
          failureThreshold: 3, // 3 fallos antes de abrir el circuito
          recoveryTimeout: 30000, // 30 segundos de espera
          expectedResponseTime: 2000, // 2 segundos de tiempo de respuesta esperado
          monitoringWindow: 60000, // Ventana de monitoreo de 1 minuto
          minimumRequestCount: 5, // Mínimo 5 requests antes de abrir el circuito
        }
      );

      logger.info('JWT token verified successfully', {
        sub: payload.sub,
        username: payload.username,
        email: payload.email,
        exp: payload.exp,
        correlationId: this.generateCorrelationId(),
      });

      // Verify token expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
        errorType = 'TOKEN_EXPIRED';
        logger.warn('Authentication failed: Token expired', {
          exp: payload.exp,
          now,
          correlationId: this.generateCorrelationId(),
        });

        performanceMonitor.complete(false, {
          error: 'TOKEN_EXPIRED',
          errorType,
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

      success = true;
      logger.info('User authenticated successfully', {
        userId: user.userId,
        username: user.username,
        email: user.email,
        groups: user.groups,
        correlationId: this.generateCorrelationId(),
      });

      performanceMonitor.complete(true, {
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
      errorType = 'INVALID_TOKEN';
      logger.error('Authentication failed', {
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        correlationId: this.generateCorrelationId(),
      });

      performanceMonitor.complete(false, {
        error: 'INVALID_TOKEN',
        errorType,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: 'Invalid authentication token',
      };
    } finally {
      const duration = Date.now() - startTime;
      await metricsService.recordAuthenticationMetrics(
        success,
        duration,
        errorType
      );
    }
  }

  /**
   * Store authenticated connection in DynamoDB
   */
  async storeAuthenticatedConnection(
    connectionId: string,
    user: AuthenticatedUser
  ): Promise<void> {
    const startTime = Date.now();
    let success = false;
    let errorType: string | undefined;

    try {
      const now = Date.now();
      const ttl = Math.floor(now / 1000) + 24 * 60 * 60; // 24 hours TTL

      logger.info('Storing authenticated connection in DynamoDB', {
        connectionId,
        userId: user.userId,
        ttl,
        correlationId: this.generateCorrelationId(),
      });

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

      success = true;
      logger.info('Authenticated connection stored in DynamoDB', {
        connectionId,
        userId: user.userId,
        ttl,
        correlationId: this.generateCorrelationId(),
      });
    } catch (error) {
      errorType = 'DATABASE_ERROR';
      logger.error('Failed to store authenticated connection', {
        connectionId,
        userId: user.userId,
        error: error instanceof Error ? error.message : String(error),
        correlationId: this.generateCorrelationId(),
      });
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      await metricsService.recordDatabaseMetrics(
        'store_connection',
        this.tableName,
        success,
        duration,
        errorType
      );
    }
  }

  /**
   * Get authenticated connection from DynamoDB
   */
  async getAuthenticatedConnection(
    connectionId: string
  ): Promise<AuthenticatedConnection | undefined> {
    const startTime = Date.now();
    let success = false;
    let errorType: string | undefined;

    try {
      logger.debug('Getting authenticated connection from DynamoDB', {
        connectionId,
        correlationId: this.generateCorrelationId(),
      });

      const result = await this.ddbClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { connectionId },
        })
      );

      if (!result.Item) {
        logger.debug('Connection not found in DynamoDB', {
          connectionId,
          correlationId: this.generateCorrelationId(),
        });
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
          correlationId: this.generateCorrelationId(),
        });
        await this.removeAuthenticatedConnection(connectionId);
        return undefined;
      }

      success = true;
      logger.debug('Authenticated connection retrieved successfully', {
        connectionId,
        userId: connection.user.userId,
        correlationId: this.generateCorrelationId(),
      });

      return connection;
    } catch (error) {
      errorType = 'DATABASE_ERROR';
      logger.error('Failed to get authenticated connection', {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
        correlationId: this.generateCorrelationId(),
      });
      return undefined;
    } finally {
      const duration = Date.now() - startTime;
      await metricsService.recordDatabaseMetrics(
        'get_connection',
        this.tableName,
        success,
        duration,
        errorType
      );
    }
  }

  /**
   * Check if connection is authenticated
   */
  async isConnectionAuthenticated(connectionId: string): Promise<boolean> {
    const connection = await this.getAuthenticatedConnection(connectionId);
    const isAuthenticated = connection?.isAuthenticated || false;

    logger.debug('Checking connection authentication status', {
      connectionId,
      isAuthenticated,
      correlationId: this.generateCorrelationId(),
    });

    return isAuthenticated;
  }

  /**
   * Remove authenticated connection from DynamoDB
   */
  async removeAuthenticatedConnection(connectionId: string): Promise<void> {
    const startTime = Date.now();
    let success = false;
    let errorType: string | undefined;

    try {
      logger.info('Removing authenticated connection from DynamoDB', {
        connectionId,
        correlationId: this.generateCorrelationId(),
      });

      await this.ddbClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { connectionId },
        })
      );

      success = true;
      logger.info('Authenticated connection removed from DynamoDB', {
        connectionId,
        correlationId: this.generateCorrelationId(),
      });
    } catch (error) {
      errorType = 'DATABASE_ERROR';
      logger.error('Failed to remove authenticated connection', {
        connectionId,
        error: error instanceof Error ? error.message : String(error),
        correlationId: this.generateCorrelationId(),
      });
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      await metricsService.recordDatabaseMetrics(
        'remove_connection',
        this.tableName,
        success,
        duration,
        errorType
      );
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
    const hasGroup = user?.groups?.includes(requiredGroup) || false;

    logger.debug('Checking user group membership', {
      connectionId,
      userId: user?.userId,
      requiredGroup,
      hasGroup,
      correlationId: this.generateCorrelationId(),
    });

    return hasGroup;
  }

  /**
   * Clean up expired connections using DynamoDB TTL
   * Note: DynamoDB automatically deletes items when TTL expires
   * This method is for manual cleanup if needed
   */
  async cleanupExpiredConnections(): Promise<void> {
    const startTime = Date.now();
    let success = false;
    let errorType: string | undefined;

    try {
      const now = Math.floor(Date.now() / 1000);

      logger.info('Starting expired connections cleanup', {
        correlationId: this.generateCorrelationId(),
      });

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
          correlationId: this.generateCorrelationId(),
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

        success = true;
        logger.info('Cleaned up expired connections', {
          count: result.Items.length,
          correlationId: this.generateCorrelationId(),
        });
      } else {
        success = true;
        logger.debug('No expired connections found for cleanup', {
          correlationId: this.generateCorrelationId(),
        });
      }
    } catch (error) {
      errorType = 'DATABASE_ERROR';
      logger.error('Failed to cleanup expired connections', {
        error: error instanceof Error ? error.message : String(error),
        correlationId: this.generateCorrelationId(),
      });
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      await metricsService.recordDatabaseMetrics(
        'cleanup_expired',
        this.tableName,
        success,
        duration,
        errorType
      );
    }
  }

  /**
   * Generate a correlation ID for request tracking
   */
  private generateCorrelationId(): string {
    return `auth-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Singleton instance
export const authenticationService = new AuthenticationService();
