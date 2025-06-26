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
}

export class AuthenticationService {
  private readonly verifier: ReturnType<typeof CognitoJwtVerifier.create>;
  private readonly authenticatedConnections: Map<
    string,
    AuthenticatedConnection
  >;

  constructor() {
    this.verifier = CognitoJwtVerifier.create({
      userPoolId: process.env.COGNITO_USER_POOL_ID!,
      tokenUse: 'access',
      clientId: process.env.COGNITO_CLIENT_ID!,
    });
    this.authenticatedConnections = new Map();
  }

  /**
   * Authenticate a user with JWT token
   */
  async authenticateUser(token: string): Promise<AuthenticationResult> {
    try {
      if (!token) {
        return {
          success: false,
          error: 'Missing authentication token',
        };
      }

      const payload = await this.verifier.verify(token);

      // Verify token expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < now) {
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
      });

      return {
        success: true,
        user,
      };
    } catch (error) {
      logger.error('Authentication failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: 'Invalid authentication token',
      };
    }
  }

  /**
   * Store authenticated connection
   */
  storeAuthenticatedConnection(
    connectionId: string,
    user: AuthenticatedUser
  ): void {
    const connection: AuthenticatedConnection = {
      connectionId,
      user,
      isAuthenticated: true,
      authenticatedAt: Date.now(),
    };

    this.authenticatedConnections.set(connectionId, connection);

    logger.info('Authenticated connection stored', {
      connectionId,
      userId: user.userId,
    });
  }

  /**
   * Get authenticated connection
   */
  getAuthenticatedConnection(
    connectionId: string
  ): AuthenticatedConnection | undefined {
    return this.authenticatedConnections.get(connectionId);
  }

  /**
   * Check if connection is authenticated
   */
  isConnectionAuthenticated(connectionId: string): boolean {
    const connection = this.authenticatedConnections.get(connectionId);
    return connection?.isAuthenticated || false;
  }

  /**
   * Remove authenticated connection
   */
  removeAuthenticatedConnection(connectionId: string): void {
    const connection = this.authenticatedConnections.get(connectionId);
    if (connection) {
      this.authenticatedConnections.delete(connectionId);
      logger.info('Authenticated connection removed', {
        connectionId,
        userId: connection.user.userId,
      });
    }
  }

  /**
   * Get user from authenticated connection
   */
  getUserFromConnection(connectionId: string): AuthenticatedUser | undefined {
    const connection = this.authenticatedConnections.get(connectionId);
    return connection?.user;
  }

  /**
   * Check if user has required group
   */
  hasUserGroup(connectionId: string, requiredGroup: string): boolean {
    const user = this.getUserFromConnection(connectionId);
    return user?.groups?.includes(requiredGroup) || false;
  }

  /**
   * Clean up expired connections (for production, use DynamoDB TTL)
   */
  cleanupExpiredConnections(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    const expiredConnections: string[] = [];

    for (const [
      connectionId,
      connection,
    ] of this.authenticatedConnections.entries()) {
      if (now - connection.authenticatedAt > maxAgeMs) {
        expiredConnections.push(connectionId);
      }
    }

    expiredConnections.forEach(connectionId => {
      this.removeAuthenticatedConnection(connectionId);
    });

    if (expiredConnections.length > 0) {
      logger.info('Cleaned up expired connections', {
        count: expiredConnections.length,
      });
    }
  }
}

// Singleton instance
export const authenticationService = new AuthenticationService();
