import { DomainError, ErrorDto } from '@awslambdahackathon/types';

/**
 * Mapper for converting errors to DTOs for serialization
 */
export class ErrorDtoMapper {
  /**
   * Convert DomainError to ErrorDto
   */
  static toDto(error: DomainError, includeStack: boolean = false): ErrorDto {
    return {
      name: error.name,
      message: error.message,
      code: error.code,
      details: error.details,
      correlationId: error.correlationId,
      timestamp: new Date().toISOString(),
      stack: includeStack ? error.stack : undefined,
    };
  }

  /**
   * Convert generic Error to ErrorDto
   */
  static genericErrorToDto(
    error: Error,
    includeStack: boolean = false
  ): ErrorDto {
    return {
      name: error.name,
      message: error.message,
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
      stack: includeStack ? error.stack : undefined,
    };
  }

  /**
   * Convert unknown error to ErrorDto
   */
  static unknownErrorToDto(
    error: unknown,
    includeStack: boolean = false
  ): ErrorDto {
    if (error instanceof DomainError) {
      return this.toDto(error, includeStack);
    }

    if (error instanceof Error) {
      return this.genericErrorToDto(error, includeStack);
    }

    // Handle primitive error values
    const message =
      typeof error === 'string' ? error : 'Unknown error occurred';

    return {
      name: 'UnknownError',
      message,
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
      details: {
        originalError: error,
      },
    };
  }

  /**
   * Create error DTO for API responses
   */
  static toApiError(
    error: unknown,
    correlationId?: string,
    includeStack: boolean = false
  ): ErrorDto {
    const errorDto = this.unknownErrorToDto(error, includeStack);

    if (correlationId) {
      errorDto.correlationId = correlationId;
    }

    return errorDto;
  }

  /**
   * Create validation error DTO
   */
  static validationErrorToDto(
    message: string,
    field: string,
    validationErrors: Record<string, unknown>,
    correlationId?: string
  ): ErrorDto {
    return {
      name: 'ValidationError',
      message,
      code: 'VALIDATION_ERROR',
      details: {
        field,
        validationErrors,
      },
      correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create authentication error DTO
   */
  static authenticationErrorToDto(
    message: string,
    userId?: string,
    correlationId?: string
  ): ErrorDto {
    return {
      name: 'AuthenticationError',
      message,
      code: 'AUTHENTICATION_ERROR',
      details: {
        userId,
      },
      correlationId,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create authorization error DTO
   */
  static authorizationErrorToDto(
    message: string,
    userId?: string,
    requiredPermissions?: string[],
    correlationId?: string
  ): ErrorDto {
    return {
      name: 'AuthorizationError',
      message,
      code: 'AUTHORIZATION_ERROR',
      details: {
        userId,
        requiredPermissions,
      },
      correlationId,
      timestamp: new Date().toISOString(),
    };
  }
}
