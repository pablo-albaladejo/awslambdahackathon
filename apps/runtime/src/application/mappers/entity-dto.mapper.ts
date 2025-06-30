import {
  ConnectionDto,
  MessageDto,
  SessionDto,
  UserDto,
} from '@awslambdahackathon/types';
import { Connection } from '@domain/entities/connection';
import { Message, MessageType } from '@domain/entities/message';
import { Session } from '@domain/entities/session';
import { User } from '@domain/entities/user';

/**
 * Mapper for converting User entity to UserDto
 */
export class UserEntityMapper {
  static toDto(user: User): UserDto {
    return {
      id: user.getId().getValue(),
      username: user.getUsername(),
      email: user.getEmail(),
      groups: user.getGroups(),
      createdAt: user.getCreatedAt().toISOString(),
      lastActivityAt: user.getLastActivityAt().toISOString(),
      isActive: user.isActive(),
    };
  }

  static toDtoArray(users: User[]): UserDto[] {
    return users.map(user => this.toDto(user));
  }
}

/**
 * Mapper for converting Connection entity to ConnectionDto
 */
export class ConnectionEntityMapper {
  static toDto(connection: Connection): ConnectionDto {
    return {
      id: connection.getId().getValue(),
      userId: connection.getUserId()?.getValue() || '',
      sessionId: connection.getSessionId()?.getValue(),
      connectedAt: connection.getConnectedAt().toISOString(),
      lastPingAt: connection.getLastActivityAt().toISOString(),
      isActive: connection.isConnected(),
      metadata: connection.getMetadata(),
    };
  }

  static toDtoArray(connections: Connection[]): ConnectionDto[] {
    return connections.map(connection => this.toDto(connection));
  }
}

/**
 * Mapper for converting Message entity to MessageDto
 */
export class MessageEntityMapper {
  private static mapMessageType(
    type: MessageType
  ): 'text' | 'system' | 'notification' {
    switch (type) {
      case MessageType.USER:
        return 'text';
      case MessageType.SYSTEM:
      case MessageType.ADMIN:
        return 'system';
      case MessageType.BOT:
        return 'notification';
      default:
        return 'text';
    }
  }

  static toDto(message: Message): MessageDto {
    return {
      id: message.getId().getValue(),
      content: message.getContent(),
      senderId: message.getUserId().getValue(),
      sessionId: message.getSessionId().getValue(),
      timestamp: message.getCreatedAt().toISOString(),
      type: this.mapMessageType(message.getType()),
      metadata: message.getMetadata(),
    };
  }

  static toDtoArray(messages: Message[]): MessageDto[] {
    return messages.map(message => this.toDto(message));
  }
}

/**
 * Mapper for converting Session entity to SessionDto
 */
export class SessionEntityMapper {
  static toDto(session: Session): SessionDto {
    return {
      id: session.getId().getValue(),
      userId: session.getUserId().getValue(),
      createdAt: session.getCreatedAt().toISOString(),
      expiresAt: session.getExpiresAt().toISOString(),
      isActive: session.isActive(),
      metadata: session.getMetadata(),
    };
  }

  static toDtoArray(sessions: Session[]): SessionDto[] {
    return sessions.map(session => this.toDto(session));
  }
}

/**
 * Aggregate mapper for all entities
 */
export class EntityDtoMapper {
  static readonly User = UserEntityMapper;
  static readonly Connection = ConnectionEntityMapper;
  static readonly Message = MessageEntityMapper;
  static readonly Session = SessionEntityMapper;
}
