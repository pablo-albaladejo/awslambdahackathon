import { DomainError } from '@awslambdahackathon/types';

// Re-export base types for convenience
export { DomainError, ErrorCode } from '@awslambdahackathon/types';

// Domain-specific error classes extending the shared base
export class ValidationError extends DomainError {
  constructor(
    message: string,
    field?: string,
    validationErrors?: Record<string, unknown>
  ) {
    super(message, 'VALIDATION_ERROR', {
      field,
      validationErrors,
    });
    this.name = 'ValidationError';
  }
}

export class EntityNotFoundError extends DomainError {
  constructor(
    entityType: string,
    identifier: string,
    details?: Record<string, unknown>
  ) {
    super(
      `${entityType} with identifier '${identifier}' not found`,
      'NOT_FOUND',
      { entityType, identifier, ...details }
    );
    this.name = 'EntityNotFoundError';
  }
}

export class AuthenticationError extends DomainError {
  constructor(
    message: string,
    userId?: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'AUTHENTICATION_ERROR', { userId, ...details });
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends DomainError {
  constructor(
    message: string,
    userId?: string,
    requiredPermissions?: string[],
    details?: Record<string, unknown>
  ) {
    super(message, 'AUTHORIZATION_ERROR', {
      userId,
      requiredPermissions,
      ...details,
    });
    this.name = 'AuthorizationError';
  }
}

export class ConflictError extends DomainError {
  constructor(
    message: string,
    resourceType?: string,
    identifier?: string,
    version?: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'CONFLICT', {
      resourceType,
      identifier,
      version,
      ...details,
    });
    this.name = 'ConflictError';
  }
}

export class BusinessRuleViolationError extends DomainError {
  constructor(
    message: string,
    ruleName: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'CONFLICT', {
      ruleName,
      ...context,
    });
    this.name = 'BusinessRuleViolationError';
  }
}

export class ConnectionError extends DomainError {
  constructor(
    message: string,
    connectionId?: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'INTERNAL_ERROR', {
      connectionId,
      ...details,
    });
    this.name = 'ConnectionError';
  }
}

export class MessageError extends DomainError {
  constructor(
    message: string,
    messageId?: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'INTERNAL_ERROR', {
      messageId,
      ...details,
    });
    this.name = 'MessageError';
  }
}

export class InfrastructureError extends DomainError {
  constructor(
    message: string,
    service?: string,
    operation?: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'INTERNAL_ERROR', {
      service,
      operation,
      ...details,
    });
    this.name = 'InfrastructureError';
  }
}

export class RateLimitError extends DomainError {
  constructor(
    message: string,
    limit: number,
    window: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'RATE_LIMIT_ERROR', {
      limit,
      window,
      ...details,
    });
    this.name = 'RateLimitError';
  }
}

export class CircuitBreakerError extends DomainError {
  constructor(
    service: string,
    state: string,
    operation?: string,
    details?: Record<string, unknown>
  ) {
    super(
      `Circuit breaker is ${state} for service: ${service}`,
      'CIRCUIT_BREAKER_ERROR',
      { service, state, operation, ...details }
    );
    this.name = 'CircuitBreakerError';
  }
}

// Migrated specific error classes - using shared DomainError base
export class UserAuthenticationFailedException extends DomainError {
  constructor(
    reason: string,
    userId?: string,
    details?: Record<string, unknown>
  ) {
    super(`Authentication failed: ${reason}`, 'USER_AUTHENTICATION_FAILED', {
      reason,
      userId,
      ...details,
    });
    this.name = 'UserAuthenticationFailedException';
  }
}

export class UserNotFoundException extends DomainError {
  constructor(userId: string, details?: Record<string, unknown>) {
    super(`User not found: ${userId}`, 'USER_NOT_FOUND', {
      userId,
      ...details,
    });
    this.name = 'UserNotFoundException';
  }
}

export class ConnectionNotFoundException extends DomainError {
  constructor(connectionId: string, details?: Record<string, unknown>) {
    super(`Connection not found: ${connectionId}`, 'CONNECTION_NOT_FOUND', {
      connectionId,
      ...details,
    });
    this.name = 'ConnectionNotFoundException';
  }
}

export class MessageValidationException extends DomainError {
  constructor(
    field: string,
    value: unknown,
    reason: string,
    details?: Record<string, unknown>
  ) {
    super(
      `Message validation failed for field '${field}': ${reason}`,
      'MESSAGE_VALIDATION_FAILED',
      { field, value, reason, ...details }
    );
    this.name = 'MessageValidationException';
  }
}

export class SessionExpiredException extends DomainError {
  constructor(sessionId: string, details?: Record<string, unknown>) {
    super(`Session expired: ${sessionId}`, 'SESSION_EXPIRED', {
      sessionId,
      ...details,
    });
    this.name = 'SessionExpiredException';
  }
}

export class UserAuthorizationException extends DomainError {
  constructor(
    userId: string,
    requiredPermission: string,
    reason: string,
    details?: Record<string, unknown>
  ) {
    super(
      `User ${userId} not authorized for ${requiredPermission}: ${reason}`,
      'USER_AUTHORIZATION_FAILED',
      { userId, requiredPermission, reason, ...details }
    );
    this.name = 'UserAuthorizationException';
  }
}

export class ConnectionLimitExceededException extends DomainError {
  constructor(
    userId: string,
    currentConnections: number,
    maxConnections: number,
    details?: Record<string, unknown>
  ) {
    super(
      `Connection limit exceeded for user ${userId}`,
      'CONNECTION_LIMIT_EXCEEDED',
      { userId, currentConnections, maxConnections, ...details }
    );
    this.name = 'ConnectionLimitExceededException';
  }
}

export class MessageRateLimitExceededException extends DomainError {
  constructor(
    userId: string,
    timeWindow: number,
    details?: Record<string, unknown>
  ) {
    super(
      `Message rate limit exceeded for user ${userId}`,
      'MESSAGE_RATE_LIMIT_EXCEEDED',
      { userId, timeWindow, ...details }
    );
    this.name = 'MessageRateLimitExceededException';
  }
}

export class InvalidTokenException extends DomainError {
  constructor(reason: string, details?: Record<string, unknown>) {
    super(`Invalid token: ${reason}`, 'INVALID_TOKEN', {
      reason,
      ...details,
    });
    this.name = 'InvalidTokenException';
  }
}

export class ServiceUnavailableException extends DomainError {
  constructor(
    serviceName: string,
    reason: string,
    details?: Record<string, unknown>
  ) {
    super(
      `Service ${serviceName} unavailable: ${reason}`,
      'SERVICE_UNAVAILABLE',
      { serviceName, reason, ...details }
    );
    this.name = 'ServiceUnavailableException';
  }
}

export class CircuitBreakerOpenException extends DomainError {
  constructor(
    serviceName: string,
    operation: string,
    details?: Record<string, unknown>
  ) {
    super(
      `Circuit breaker is open for ${serviceName}:${operation}`,
      'CIRCUIT_BREAKER_OPEN',
      { serviceName, operation, ...details }
    );
    this.name = 'CircuitBreakerOpenException';
  }
}
