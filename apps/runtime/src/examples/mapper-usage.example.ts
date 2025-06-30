/**
 * Example showing proper usage of mappers instead of toJSON methods
 * This demonstrates Clean Architecture best practices
 */

import { EntityDtoMapper } from '@application/mappers/entity-dto.mapper';
import { ErrorDtoMapper } from '@application/mappers/error-dto.mapper';
import { ErrorDto, UserDto } from '@awslambdahackathon/types';
import { User } from '@domain/entities/user';
import { ValidationError } from '@domain/errors/domain-errors';

/**
 * ❌ OLD APPROACH (Violates Clean Architecture)
 */
export function oldApproachExample() {
  // These are just examples of what NOT to do
  void User.create('user123', 'john_doe', 'john@example.com', ['user']);
  void new ValidationError('Invalid input', 'email');

  // ❌ BAD: Domain entity knows about JSON serialization
  // const userData = user.toJSON(); // This method is now removed!

  // ❌ BAD: Error has serialization concerns
  // const errorData = error.toJSON(); // This method is now removed!
}

/**
 * ✅ NEW APPROACH (Follows Clean Architecture)
 */
export function newApproachExample() {
  // Create domain entities (pure domain logic)
  const user = User.create('user123', 'john_doe', 'john@example.com', ['user']);
  const error = new ValidationError('Invalid input', 'email');

  // ✅ GOOD: Use dedicated mappers for serialization
  const userDto: UserDto = EntityDtoMapper.User.toDto(user);
  const errorDto: ErrorDto = ErrorDtoMapper.unknownErrorToDto(error, false);

  // ✅ GOOD: DTOs are perfect for API responses
  // Using logger instead of console for production code
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.log('User DTO:', userDto);
    // eslint-disable-next-line no-console
    console.log('Error DTO:', errorDto);
  }

  return { userDto, errorDto };
}

/**
 * ✅ USE CASE: API Controller Example
 */
class UserController {
  async getUser(
    userId: string
  ): Promise<{ success: boolean; data?: UserDto; error?: ErrorDto }> {
    try {
      // Domain logic - get user entity
      const user = await this.getUserFromRepository(userId);

      if (!user) {
        const error = ErrorDtoMapper.validationErrorToDto(
          'User not found',
          'userId',
          { userId }
        );
        return { success: false, error };
      }

      // ✅ Convert entity to DTO for API response
      const userDto = EntityDtoMapper.User.toDto(user);
      return { success: true, data: userDto };
    } catch (error) {
      // ✅ Handle any error type consistently
      const errorDto = ErrorDtoMapper.toApiError(error);
      return { success: false, error: errorDto };
    }
  }

  private async getUserFromRepository(userId: string): Promise<User | null> {
    // Mock implementation
    return User.create(userId, 'john_doe', 'john@example.com', ['user']);
  }
}

/**
 * ✅ USE CASE: WebSocket Message Handler Example
 */
class MessageHandler {
  handleMessage(_messageData: Record<string, unknown>): void {
    try {
      // Domain logic - this would throw validation error
      this.validateAndCreateMessage(_messageData);

      // This code won't execute due to validation error above
      // but shows the pattern for successful case
    } catch (error) {
      // ✅ Consistent error handling
      const errorDto = ErrorDtoMapper.toApiError(error);
      this.sendErrorToClient(errorDto);
    }
  }

  private validateAndCreateMessage(_data: Record<string, unknown>): never {
    void _data; // Explicitly mark as intentionally unused
    // Mock implementation - always throws for demo purposes
    throw new ValidationError('Invalid message format', 'content');
  }

  private broadcastMessage(messageDto: Record<string, unknown>): void {
    // Using proper logging instead of console
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('Broadcasting message:', messageDto);
    }
  }

  private sendErrorToClient(errorDto: ErrorDto): void {
    // Using proper logging instead of console
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.log('Sending error to client:', errorDto);
    }
  }
}

/**
 * ✅ BENEFITS OF THIS APPROACH:
 *
 * 1. SEPARATION OF CONCERNS
 *    - Domain entities focus on business logic
 *    - Mappers handle serialization
 *    - DTOs define API contracts
 *
 * 2. TESTABILITY
 *    - Domain entities easy to unit test
 *    - Mappers can be tested independently
 *    - Clear mocking boundaries
 *
 * 3. MAINTAINABILITY
 *    - API changes only affect DTOs and mappers
 *    - Domain logic stays pure
 *    - Single responsibility principle
 *
 * 4. TYPE SAFETY
 *    - DTOs shared across modules
 *    - Compile-time validation
 *    - IntelliSense support
 *
 * 5. FLEXIBILITY
 *    - Multiple DTO formats for same entity
 *    - Version-specific mappings
 *    - Context-aware serialization
 */

export { MessageHandler, UserController };
