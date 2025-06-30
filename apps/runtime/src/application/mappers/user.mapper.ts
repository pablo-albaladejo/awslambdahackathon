import { User } from '../../domain/entities/user';
import { BidirectionalMapper } from '../../shared/mappers/mapper.interface';
import { CreateUserDto, UserDto, UserUpdateDto } from '../dto/domain/user.dto';

/**
 * Bidirectional mapper for User entity and UserDto
 */
export class UserMapper implements BidirectionalMapper<User, UserDto> {
  /**
   * Maps DTO to domain entity
   */
  mapToDomain(dto: UserDto): User {
    return User.fromData({
      id: dto.id,
      username: dto.username,
      email: dto.email,
      groups: dto.groups,
      isActive: dto.isActive,
      createdAt: new Date(dto.createdAt),
      lastActivityAt: new Date(dto.lastActivityAt),
    });
  }

  /**
   * Maps domain entity to DTO
   */
  mapToDto(entity: User): UserDto {
    return {
      id: entity.getUserId(),
      username: entity.getUsername(),
      email: entity.getEmail(),
      groups: entity.getGroups(),
      isActive: entity.isActive(),
      createdAt: entity.getCreatedAt().toISOString(),
      lastActivityAt: entity.getLastActivityAt().toISOString(),
    };
  }

  /**
   * Maps array of DTOs to domain entities
   */
  mapArrayToDomain(dtos: UserDto[]): User[] {
    return dtos.map(dto => this.mapToDomain(dto));
  }

  /**
   * Maps array of domain entities to DTOs
   */
  mapArrayToDto(entities: User[]): UserDto[] {
    return entities.map(entity => this.mapToDto(entity));
  }

  /**
   * Maps CreateUserDto to User entity
   */
  fromCreateDto(dto: CreateUserDto): User {
    return User.create(
      dto.id || crypto.randomUUID(),
      dto.username,
      dto.email,
      dto.groups
    );
  }

  /**
   * Updates a User entity with data from UserUpdateDto
   */
  updateFromDto(entity: User, dto: UserUpdateDto): User {
    let updatedUser = entity;

    if (dto.groups !== undefined) {
      // Remove all groups and add new ones
      const currentGroups = updatedUser.getGroups();
      currentGroups.forEach(group => {
        updatedUser = updatedUser.removeGroup(group);
      });
      dto.groups.forEach(group => {
        updatedUser = updatedUser.addGroup(group);
      });
    }

    if (dto.isActive !== undefined) {
      if (dto.isActive) {
        updatedUser.activate();
      } else {
        updatedUser.deactivate();
      }
    }

    if (dto.lastActivityAt !== undefined) {
      updatedUser.updateLastActivity(new Date(dto.lastActivityAt));
    }

    return updatedUser;
  }
}
