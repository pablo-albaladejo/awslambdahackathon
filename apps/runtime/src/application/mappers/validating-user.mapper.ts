import { z } from 'zod';

import { User } from '../../domain/entities/user';
import {
  MappingResult,
  ValidatingMapper,
} from '../../shared/mappers/mapper.interface';
import { BaseValidator } from '../../shared/validators/base.validator';
import { CreateUserDto, UserDto } from '../dto/domain/user.dto';

// Zod schemas for validation
const UserDtoSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email format'),
  groups: z.array(
    z.enum(['admin', 'user', 'guest', 'moderator', 'banned'] as const)
  ),
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  lastActivityAt: z.string().datetime(),
});

const CreateUserDtoSchema = z.object({
  id: z.string().min(1).optional(),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email format'),
  groups: z
    .array(z.enum(['admin', 'user', 'guest', 'moderator', 'banned'] as const))
    .optional(),
  isActive: z.boolean().optional(),
});

/**
 * Validating mapper for User entity and UserDto with comprehensive validation
 */
export class ValidatingUserMapper
  extends BaseValidator<UserDto>
  implements ValidatingMapper<UserDto, User>
{
  protected schema = UserDtoSchema;

  /**
   * Maps and validates UserDto to User entity
   */
  mapAndValidate(dto: UserDto): User {
    const validationResult = this.validate(dto);
    if (!validationResult.success) {
      throw new Error(`Validation failed: ${validationResult.error}`);
    }

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
   * Maps and validates array of UserDto to User entities
   */
  mapArrayAndValidate(dtos: UserDto[]): User[] {
    return dtos.map(dto => this.mapAndValidate(dto));
  }

  /**
   * Maps UserDto to User entity with detailed validation result
   */
  mapWithResult(dto: UserDto): MappingResult<User> {
    const validationResult = this.validate(dto);

    if (!validationResult.success) {
      // Create a placeholder user for error cases - this will be ignored due to success: false
      const errorUser = User.fromData({
        id: 'error',
        username: 'error',
        email: 'error@error.com',
        groups: [],
        isActive: false,
        createdAt: new Date(),
        lastActivityAt: new Date(),
      });

      return {
        success: false,
        data: errorUser,
        errors: [validationResult.error || 'Validation failed'],
        warnings: validationResult.warnings,
        metadata: {
          mappedAt: new Date(),
          sourceType: 'UserDto',
          targetType: 'User',
          validationErrors: validationResult.fieldErrors
            ? Object.keys(validationResult.fieldErrors).length
            : 1,
        },
      };
    }

    try {
      const user = User.fromData({
        id: dto.id,
        username: dto.username,
        email: dto.email,
        groups: dto.groups,
        isActive: dto.isActive,
        createdAt: new Date(dto.createdAt),
        lastActivityAt: new Date(dto.lastActivityAt),
      });

      return {
        success: true,
        data: user,
        errors: [],
        warnings: validationResult.warnings,
        metadata: {
          mappedAt: new Date(),
          sourceType: 'UserDto',
          targetType: 'User',
        },
      };
    } catch (error) {
      // Create a placeholder user for error cases - this will be ignored due to success: false
      const errorUser = User.fromData({
        id: 'error',
        username: 'error',
        email: 'error@error.com',
        groups: [],
        isActive: false,
        createdAt: new Date(),
        lastActivityAt: new Date(),
      });

      return {
        success: false,
        data: errorUser,
        errors: [
          error instanceof Error ? error.message : 'Unknown mapping error',
        ],
        metadata: {
          mappedAt: new Date(),
          sourceType: 'UserDto',
          targetType: 'User',
        },
      };
    }
  }

  /**
   * Maps array with detailed validation results
   */
  mapArrayWithResult(dtos: UserDto[]): MappingResult<User[]> {
    const results: User[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    dtos.forEach((dto, index) => {
      const result = this.mapWithResult(dto);
      if (result.success && result.data) {
        results.push(result.data);
      } else {
        errors.push(
          `Item ${index}: ${result.errors?.join(', ') || 'Unknown error'}`
        );
      }
      if (result.warnings) {
        warnings.push(...result.warnings.map(w => `Item ${index}: ${w}`));
      }
    });

    return {
      success: errors.length === 0,
      data: results,
      errors,
      warnings,
      metadata: {
        mappedAt: new Date(),
        sourceType: 'UserDto[]',
        targetType: 'User[]',
        count: dtos.length,
        successCount: results.length,
        errorCount: errors.length,
      },
    };
  }

  /**
   * Validates and maps CreateUserDto to User entity
   */
  validateAndCreateUser(dto: CreateUserDto): MappingResult<User> {
    const validationResult = CreateUserDtoSchema.safeParse(dto);

    if (!validationResult.success) {
      // Create a placeholder user for error cases - this will be ignored due to success: false
      const errorUser = User.fromData({
        id: 'error',
        username: 'error',
        email: 'error@error.com',
        groups: [],
        isActive: false,
        createdAt: new Date(),
        lastActivityAt: new Date(),
      });

      return {
        success: false,
        data: errorUser,
        errors: validationResult.error.errors.map(
          e => `${e.path.join('.')}: ${e.message}`
        ),
        metadata: {
          mappedAt: new Date(),
          sourceType: 'CreateUserDto',
          targetType: 'User',
        },
      };
    }

    try {
      const user = User.create(
        dto.id || crypto.randomUUID(),
        dto.username,
        dto.email,
        dto.groups
      );

      return {
        success: true,
        data: user,
        errors: [],
        metadata: {
          mappedAt: new Date(),
          sourceType: 'CreateUserDto',
          targetType: 'User',
        },
      };
    } catch (error) {
      // Create a placeholder user for error cases - this will be ignored due to success: false
      const errorUser = User.fromData({
        id: 'error',
        username: 'error',
        email: 'error@error.com',
        groups: [],
        isActive: false,
        createdAt: new Date(),
        lastActivityAt: new Date(),
      });

      return {
        success: false,
        data: errorUser,
        errors: [
          error instanceof Error ? error.message : 'Unknown creation error',
        ],
        metadata: {
          mappedAt: new Date(),
          sourceType: 'CreateUserDto',
          targetType: 'User',
        },
      };
    }
  }

  /**
   * Basic map method (required by Mapper interface)
   */
  map(dto: UserDto): User {
    return this.mapAndValidate(dto);
  }

  /**
   * Basic mapArray method (required by Mapper interface)
   */
  mapArray(dtos: UserDto[]): User[] {
    return this.mapArrayAndValidate(dtos);
  }
}
