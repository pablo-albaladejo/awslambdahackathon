import { logger } from '@awslambdahackathon/utils/lambda';
import { AUTH_CONFIG } from '@config/constants';
import { container } from '@config/container';
import { Connection, ConnectionStatus } from '@domain/entities/connection';
import { User, UserGroup } from '@domain/entities/user';
import { DomainError } from '@domain/errors/domain-errors';
import { ConnectionRepository } from '@domain/repositories/connection';
import { UserRepository } from '@domain/repositories/user';
import {
  AuthenticateUserCommand,
  AuthenticationResult,
  AuthenticationService as DomainAuthenticationService,
  StoreAuthConnectionCommand,
} from '@domain/services/authentication-service';
import { ConnectionId, UserId } from '@domain/value-objects';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

export interface AuthenticatedUser {
  userId: string;
  username: string;
  groups?: string[];
}

export interface AuthenticatedConnection {
  connectionId: string;
  user: AuthenticatedUser;
  isAuthenticated: boolean;
  authenticatedAt: number;
  ttl: number;
}

export class AuthenticationService implements DomainAuthenticationService {
  private readonly verifier: ReturnType<typeof CognitoJwtVerifier.create>;
  private readonly userRepository: UserRepository;
  private readonly connectionRepository: ConnectionRepository;

  constructor() {
    logger.info('Initializing AuthenticationService');

    // Validate required environment variables
    const userPoolId = process.env.COGNITO_USER_POOL_ID;
    const clientId = process.env.COGNITO_CLIENT_ID;

    if (!userPoolId) {
      throw new Error('COGNITO_USER_POOL_ID environment variable is required');
    }
    if (!clientId) {
      throw new Error('COGNITO_CLIENT_ID environment variable is required');
    }

    this.verifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: AUTH_CONFIG.TOKEN_USE,
      clientId,
    });

    // Get repositories from container
    this.userRepository = container.get<UserRepository>('UserRepository');
    this.connectionRepository = container.get<ConnectionRepository>(
      'ConnectionRepository'
    );
  }

  async authenticateUser(
    command: AuthenticateUserCommand
  ): Promise<AuthenticationResult> {
    try {
      logger.info('Starting JWT token verification', {
        hasToken: !!command.token,
        tokenLength: command.token ? command.token.length : 0,
      });

      // Verify JWT token
      const verifier = CognitoJwtVerifier.create({
        userPoolId: process.env.COGNITO_USER_POOL_ID || '',
        clientId: process.env.COGNITO_CLIENT_ID || '',
        tokenUse: 'access',
      });

      logger.info('JWT verifier created, attempting verification');
      const payload = await verifier.verify(command.token);

      logger.info('JWT verification successful', {
        username: payload.username,
        sub: payload.sub,
        tokenUse: payload.token_use,
      });

      const user = await this.userRepository.findByUsername(payload.username);

      logger.info('User lookup completed', {
        username: payload.username,
        userFound: !!user,
        userId: user?.getId()?.getValue(),
        isActive: user?.isActive(),
      });

      if (!user) {
        logger.warn('User not found in repository', {
          username: payload.username,
        });
        return {
          success: false,
          error: 'User not found',
        };
      }

      if (!user.isActive()) {
        logger.warn('User account is not active', {
          username: payload.username,
          userId: user.getId().getValue(),
        });
        return {
          success: false,
          error: 'User account is not active',
        };
      }

      logger.info('User authentication completed successfully', {
        username: payload.username,
        userId: user.getId().getValue(),
        userGroups: user.getGroups(),
      });

      return {
        success: true,
        user,
      };
    } catch (error) {
      logger.error('JWT token verification failed', {
        error: error instanceof Error ? error.message : String(error),
        errorName: error instanceof Error ? error.name : 'Unknown',
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  async storeAuthenticatedConnection(
    command: StoreAuthConnectionCommand
  ): Promise<void> {
    try {
      logger.info('Storing authenticated connection', {
        connectionId: command.connectionId.getValue(),
        userId: command.user.getId().getValue(),
      });

      // Check if connection already exists
      const existingConnection = await this.connectionRepository.findById(
        command.connectionId
      );

      let connection: Connection;

      if (existingConnection) {
        // Update existing connection to authenticated status
        logger.info('Updating existing connection to authenticated', {
          connectionId: command.connectionId.getValue(),
          previousStatus: existingConnection.getStatus(),
          userId: command.user.getId().getValue(),
        });

        connection = existingConnection.authenticate(command.user.getId());
      } else {
        // Create new authenticated connection
        logger.info('Creating new authenticated connection', {
          connectionId: command.connectionId.getValue(),
          userId: command.user.getId().getValue(),
        });

        connection = new Connection(
          command.connectionId,
          command.user.getId(),
          null, // sessionId will be associated separately when needed
          ConnectionStatus.AUTHENTICATED,
          new Date(),
          new Date()
        );
      }

      await this.connectionRepository.save(connection);

      logger.info('Successfully stored authenticated connection', {
        connectionId: command.connectionId.getValue(),
        userId: command.user.getId().getValue(),
        status: connection.getStatus(),
      });
    } catch (error) {
      logger.error('Failed to store authenticated connection', {
        connectionId: command.connectionId.getValue(),
        userId: command.user.getId().getValue(),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async removeAuthenticatedConnection(
    connectionId: ConnectionId
  ): Promise<void> {
    await this.connectionRepository.delete(connectionId);
  }

  async isConnectionAuthenticated(
    connectionId: ConnectionId
  ): Promise<boolean> {
    try {
      logger.info('Checking connection authentication', {
        connectionId: connectionId.getValue(),
      });

      const connection = await this.connectionRepository.findById(connectionId);

      if (!connection) {
        logger.warn('Connection not found in repository', {
          connectionId: connectionId.getValue(),
        });
        return false;
      }

      const isAuthenticated = connection.isAuthenticated();
      const status = connection.getStatus();
      const userId = connection.getUserId();

      logger.info('Connection authentication check result', {
        connectionId: connectionId.getValue(),
        isAuthenticated,
        status,
        hasUserId: !!userId,
        userId: userId?.getValue(),
      });

      return isAuthenticated;
    } catch (error) {
      logger.error('Error checking connection authentication', {
        connectionId: connectionId.getValue(),
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async getUserFromConnection(
    connectionId: ConnectionId
  ): Promise<User | null> {
    const connection = await this.connectionRepository.findById(connectionId);
    if (!connection || !connection.isAuthenticated()) {
      return null;
    }
    const userId = connection.getUserId();
    if (!userId) {
      return null;
    }
    return this.userRepository.findById(userId);
  }

  async hasUserGroup(
    connectionId: ConnectionId,
    requiredGroup: string
  ): Promise<boolean> {
    const user = await this.getUserFromConnection(connectionId);
    if (!user) {
      return false;
    }
    return user.hasGroup(requiredGroup as UserGroup); // Using proper UserGroup type
  }

  async cleanupExpiredConnections(): Promise<void> {
    const expiredConnections =
      await this.connectionRepository.findExpiredConnections();
    for (const connection of expiredConnections) {
      await this.connectionRepository.delete(connection.getId());
    }
  }

  private generateCorrelationId(): string {
    return `auth-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async checkUserAuthorization(
    userId: string,
    requiredGroup: UserGroup
  ): Promise<boolean> {
    try {
      const user = await this.userRepository.findById(UserId.create(userId));

      if (!user) {
        throw new DomainError('User not found', 'AUTHORIZATION_ERROR');
      }

      if (!user.isActive()) {
        throw new DomainError(
          'User account is not active',
          'AUTHORIZATION_ERROR'
        );
      }

      return user.hasGroup(requiredGroup);
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      throw new DomainError(
        'Authorization check failed',
        'AUTHORIZATION_ERROR',
        { error }
      );
    }
  }

  async checkUserAuthorizationForGroups(
    userId: string,
    requiredGroups: UserGroup[]
  ): Promise<boolean> {
    try {
      const user = await this.userRepository.findById(UserId.create(userId));

      if (!user) {
        throw new DomainError('User not found', 'AUTHORIZATION_ERROR');
      }

      if (!user.isActive()) {
        throw new DomainError(
          'User account is not active',
          'AUTHORIZATION_ERROR'
        );
      }

      return user.hasAnyGroup(requiredGroups);
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      throw new DomainError(
        'Authorization check failed',
        'AUTHORIZATION_ERROR',
        { error }
      );
    }
  }
}
