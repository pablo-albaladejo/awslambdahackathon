import { logger } from '@awslambdahackathon/utils/lambda';
import { Session, SessionStatus } from '@domain/entities/session';
import { User } from '@domain/entities/user';
import { SessionRepository } from '@domain/repositories/session';
import { Specification } from '@domain/repositories/specification';
import { UserRepository } from '@domain/repositories/user';
import { UserId } from '@domain/value-objects';
import { BaseAdapter } from '@infrastructure/adapters/base/base-adapter';

export class DynamoDBUserRepository
  extends BaseAdapter
  implements UserRepository
{
  private static readonly SERVICE_NAME = 'SessionBasedUserRepository';

  constructor(private readonly sessionRepository: SessionRepository) {
    super();
    logger.info('Initializing session-based UserRepository');
  }

  async findById(id: UserId): Promise<User | null> {
    try {
      logger.info('Finding user by ID via active session', {
        userId: id.getValue(),
      });

      const session = await this.sessionRepository.findActiveSessionByUser(id);
      if (!session || !session.isActive() || session.isExpired()) {
        logger.warn('No active session found for user', {
          userId: id.getValue(),
        });
        return null;
      }

      // Create User from session data
      const userInfo = session.getUserInfo();
      return User.fromData({
        id: id.getValue(),
        username: userInfo.username,
        groups: ['user'],
        createdAt: session.getCreatedAt(),
        lastActivityAt: session.getLastActivityAt(),
        isActive: true,
      });
    } catch (error) {
      logger.error('Error finding user by ID', {
        userId: id.getValue(),
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async findByUsername(username: string): Promise<User | null> {
    try {
      logger.info('Finding user by username via sessions', { username });

      // Find all active sessions and check usernames
      // This is not ideal, but we don't have a username index
      const allSessions = await this.sessionRepository.findByStatus(
        SessionStatus.ACTIVE
      );

      for (const session of allSessions) {
        if (
          session.getUsername() === username &&
          session.isActive() &&
          !session.isExpired()
        ) {
          const userInfo = session.getUserInfo();
          return User.fromData({
            id: session.getUserId().getValue(),
            username: userInfo.username,
            groups: ['user'],
            createdAt: session.getCreatedAt(),
            lastActivityAt: session.getLastActivityAt(),
            isActive: true,
          });
        }
      }

      logger.warn('No active session found for username', { username });
      return null;
    } catch (error) {
      logger.error('Error finding user by username', {
        username,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async save(user: User): Promise<void> {
    try {
      logger.info('Saving user via session', {
        userId: user.getId().getValue(),
      });

      // Find existing session for this user
      let session = await this.sessionRepository.findActiveSessionByUser(
        user.getId()
      );

      if (!session || !session.isActive() || session.isExpired()) {
        // Create new session with user info
        session = Session.createWithUsername(
          user.getId(),
          user.getUsername(), // Use username
          60, // 1 hour
          60 // 1 hour max
        );
      } else {
        // Update existing session
        session = session.updateUsername(user.getUsername());
      }

      await this.sessionRepository.save(session);
      logger.info('User saved via session', {
        userId: user.getId().getValue(),
      });
    } catch (error) {
      logger.error('Error saving user', {
        userId: user.getId().getValue(),
        username: user.getUsername(),
        error: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorName: error instanceof Error ? error.name : 'Unknown',
      });

      // Provide more specific error information
      if (error instanceof Error) {
        if (error.message.includes('not authorized')) {
          throw new Error(
            `Failed to save user: Database permission denied - ${error.message}`
          );
        }
        if (error.message.includes('ValidationException')) {
          throw new Error(
            `Failed to save user: Invalid data format - ${error.message}`
          );
        }
        if (error.message.includes('ResourceNotFoundException')) {
          throw new Error(
            `Failed to save user: Database table not found - ${error.message}`
          );
        }
        throw new Error(`Failed to save user: ${error.message}`);
      }
      throw new Error('Failed to save user: Unknown error occurred');
    }
  }

  async delete(id: UserId): Promise<void> {
    try {
      logger.info('Deleting user via session deactivation', {
        userId: id.getValue(),
      });

      const session = await this.sessionRepository.findActiveSessionByUser(id);
      if (session) {
        const deactivatedSession = session.deactivate();
        await this.sessionRepository.save(deactivatedSession);
      }

      logger.info('User deleted via session deactivation', {
        userId: id.getValue(),
      });
    } catch (error) {
      logger.error('Error deleting user', {
        userId: id.getValue(),
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Failed to delete user');
    }
  }

  async exists(id: UserId): Promise<boolean> {
    try {
      const session = await this.sessionRepository.findActiveSessionByUser(id);
      return session ? session.isActive() && !session.isExpired() : false;
    } catch (error) {
      logger.error('Error checking if user exists', {
        userId: id.getValue(),
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async findAll(): Promise<User[]> {
    try {
      logger.info('Finding all users via active sessions');

      const activeSessions = await this.sessionRepository.findByStatus(
        SessionStatus.ACTIVE
      );
      const users: User[] = [];

      for (const session of activeSessions) {
        if (session.isActive() && !session.isExpired()) {
          const userInfo = session.getUserInfo();
          const user = User.fromData({
            id: session.getUserId().getValue(),
            username: userInfo.username,
            groups: ['user'],
            createdAt: session.getCreatedAt(),
            lastActivityAt: session.getLastActivityAt(),
            isActive: true,
          });
          users.push(user);
        }
      }

      return users;
    } catch (error) {
      logger.error('Error finding all users', {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  async update(user: User): Promise<void> {
    return this.save(user);
  }

  async count(): Promise<number> {
    try {
      const activeSessions = await this.sessionRepository.findByStatus(
        SessionStatus.ACTIVE
      );
      return activeSessions.filter(s => s.isActive() && !s.isExpired()).length;
    } catch (error) {
      logger.error('Error counting users', {
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  async findBySpecification(
    specification: Specification<User>
  ): Promise<User[]> {
    const allUsers = await this.findAll();
    return allUsers.filter(user => specification.isSatisfiedBy(user));
  }

  async updateLastActivity(id: UserId): Promise<void> {
    try {
      const session = await this.sessionRepository.findActiveSessionByUser(id);
      if (session) {
        const updatedSession = session.updateActivity();
        await this.sessionRepository.save(updatedSession);
      }
    } catch (error) {
      logger.error('Error updating user last activity', {
        userId: id.getValue(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
