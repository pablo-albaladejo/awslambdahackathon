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
import { ConnectionId } from '@domain/value-objects';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

export interface AuthenticatedUser {
  userId: string;
  username: string;
  email: string;
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
    this.userRepository = container.get<UserRepository>('userRepository');
    this.connectionRepository = container.get<ConnectionRepository>(
      'connectionRepository'
    );
  }

  async authenticateUser(
    command: AuthenticateUserCommand
  ): Promise<AuthenticationResult> {
    try {
      // Verify JWT token
      const verifier = CognitoJwtVerifier.create({
        userPoolId: process.env.COGNITO_USER_POOL_ID || '',
        clientId: process.env.COGNITO_CLIENT_ID || '',
        tokenUse: 'access',
      });

      const payload = await verifier.verify(command.token);
      const user = await this.userRepository.findByUsername(payload.username);

      if (!user) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      if (!user.isActive()) {
        return {
          success: false,
          error: 'User account is not active',
        };
      }

      return {
        success: true,
        user,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      };
    }
  }

  async storeAuthenticatedConnection(
    command: StoreAuthConnectionCommand
  ): Promise<void> {
    const connection = new Connection(
      command.connectionId,
      command.user.getId(),
      ConnectionStatus.AUTHENTICATED,
      new Date(),
      new Date()
    );
    await this.connectionRepository.save(connection);
  }

  async removeAuthenticatedConnection(
    connectionId: ConnectionId
  ): Promise<void> {
    await this.connectionRepository.delete(connectionId);
  }

  async isConnectionAuthenticated(
    connectionId: ConnectionId
  ): Promise<boolean> {
    const connection = await this.connectionRepository.findById(connectionId);
    return connection?.isAuthenticated() || false;
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
      const user = await this.userRepository.findById(userId);

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
      const user = await this.userRepository.findById(userId);

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
