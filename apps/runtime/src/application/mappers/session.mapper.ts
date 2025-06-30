import { Session, SessionStatus } from '@domain/entities/session';
import { UserId } from '@domain/value-objects/user-id';

import {
  CreateSessionDto,
  SessionDto,
  UpdateSessionDto,
} from '../dto/domain/session.dto';

import { BidirectionalMapper } from '@/shared/mappers/mapper.interface';

/**
 * Bidirectional mapper for Session entity and SessionDto
 */
export class SessionMapper implements BidirectionalMapper<Session, SessionDto> {
  /**
   * Maps DTO to domain entity
   */
  mapToDomain(dto: SessionDto): Session {
    return Session.fromData({
      id: dto.id,
      userId: dto.userId,
      status: dto.isActive ? SessionStatus.ACTIVE : SessionStatus.INACTIVE,
      createdAt: new Date(dto.createdAt),
      expiresAt: new Date(dto.expiresAt),
      lastActivityAt: new Date(dto.lastActivityAt),
      metadata: dto.metadata,
      username: dto.username,
    });
  }

  /**
   * Maps domain entity to DTO
   */
  mapToDto(entity: Session): SessionDto {
    return {
      id: entity.getId().getValue(),
      userId: entity.getUserId().getValue(),
      username: entity.getUsername(),
      createdAt: entity.getCreatedAt().toISOString(),
      expiresAt: entity.getExpiresAt().toISOString(),
      lastActivityAt: entity.getLastActivityAt().toISOString(),
      isActive: entity.isActive(),
      metadata: entity.getMetadata(),
    };
  }

  /**
   * Maps array of DTOs to domain entities
   */
  mapArrayToDomain(dtos: SessionDto[]): Session[] {
    return dtos.map(dto => this.mapToDomain(dto));
  }

  /**
   * Maps array of domain entities to DTOs
   */
  mapArrayToDto(entities: Session[]): SessionDto[] {
    return entities.map(entity => this.mapToDto(entity));
  }

  /**
   * Maps CreateSessionDto to Session entity
   */
  fromCreateDto(dto: CreateSessionDto): Session {
    const expiresAt = new Date(dto.expiresAt);
    const durationInMinutes = Math.floor(
      (expiresAt.getTime() - Date.now()) / (1000 * 60)
    );
    const userId = UserId.create(dto.userId);

    return Session.createWithUsername(userId, dto.username, durationInMinutes);
  }

  /**
   * Updates a Session entity with data from UpdateSessionDto
   */
  updateFromDto(entity: Session, dto: UpdateSessionDto): Session {
    let updatedSession = entity;

    if (dto.expiresAt !== undefined) {
      const newExpiresAt = new Date(dto.expiresAt);
      const currentTime = Date.now();
      const durationInMinutes = Math.floor(
        (newExpiresAt.getTime() - currentTime) / (1000 * 60)
      );
      updatedSession = updatedSession.extend(durationInMinutes);
    }

    if (dto.lastActivityAt !== undefined) {
      updatedSession = updatedSession.updateActivity();
    }

    if (dto.isActive !== undefined) {
      if (dto.isActive) {
        updatedSession = updatedSession.reactivate();
      } else {
        updatedSession = updatedSession.deactivate();
      }
    }

    // Update username if provided
    if (dto.username !== undefined) {
      updatedSession = updatedSession.updateUsername(dto.username);
    }

    if (dto.metadata !== undefined) {
      // Add each metadata property
      Object.entries(dto.metadata).forEach(([key, value]) => {
        updatedSession = updatedSession.addMetadata(key, value);
      });
    }

    return updatedSession;
  }
}
