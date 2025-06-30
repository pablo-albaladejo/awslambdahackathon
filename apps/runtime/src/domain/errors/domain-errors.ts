export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'CIRCUIT_BREAKER_ERROR';

export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DomainError';
    Object.setPrototypeOf(this, DomainError.prototype);
  }
}

export class ValidationError extends DomainError {
  constructor(
    message: string,
    field?: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'VALIDATION_ERROR', details);
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
  }
}

export class AuthenticationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'AUTHENTICATION_ERROR', details);
  }
}

export class AuthorizationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'AUTHORIZATION_ERROR', details);
  }
}

export class BusinessRuleViolationError extends DomainError {
  constructor(
    message: string,
    ruleName: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'CONFLICT', {
      ruleName,
      ...details,
    });
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
  }
}

export class InfrastructureError extends DomainError {
  constructor(
    message: string,
    service: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'INTERNAL_ERROR', {
      service,
      ...details,
    });
  }
}

export class RateLimitError extends DomainError {
  constructor(
    message: string,
    limit: number,
    window: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'INTERNAL_ERROR', {
      limit,
      window,
      ...details,
    });
  }
}

export class CircuitBreakerError extends DomainError {
  constructor(
    service: string,
    state: string,
    details?: Record<string, unknown>
  ) {
    super(
      `Circuit breaker is ${state} for service: ${service}`,
      'CIRCUIT_BREAKER_ERROR',
      { service, state, ...details }
    );
  }
}

export class DomainException extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DomainException';
  }
}

export class UserAuthenticationFailedException extends DomainException {
  constructor(
    public readonly reason: string,
    public readonly userId?: string
  ) {
    super(`Authentication failed: ${reason}`, 'USER_AUTHENTICATION_FAILED', {
      reason,
      userId,
    });
    this.name = 'UserAuthenticationFailedException';
  }
}

export class UserNotFoundException extends DomainException {
  constructor(public readonly userId: string) {
    super(`User not found: ${userId}`, 'USER_NOT_FOUND', { userId });
    this.name = 'UserNotFoundException';
  }
}

export class ConnectionNotFoundException extends DomainException {
  constructor(public readonly connectionId: string) {
    super(`Connection not found: ${connectionId}`, 'CONNECTION_NOT_FOUND', {
      connectionId,
    });
    this.name = 'ConnectionNotFoundException';
  }
}

export class MessageValidationException extends DomainException {
  constructor(
    public readonly field: string,
    public readonly value: unknown,
    public readonly reason: string
  ) {
    super(
      `Message validation failed for field '${field}': ${reason}`,
      'MESSAGE_VALIDATION_FAILED',
      { field, value, reason }
    );
    this.name = 'MessageValidationException';
  }
}

export class SessionExpiredException extends DomainException {
  constructor(public readonly sessionId: string) {
    super(`Session expired: ${sessionId}`, 'SESSION_EXPIRED', { sessionId });
    this.name = 'SessionExpiredException';
  }
}

export class UserAuthorizationException extends DomainException {
  constructor(
    public readonly userId: string,
    public readonly requiredPermission: string,
    public readonly reason: string
  ) {
    super(
      `User ${userId} not authorized for ${requiredPermission}: ${reason}`,
      'USER_AUTHORIZATION_FAILED',
      { userId, requiredPermission, reason }
    );
    this.name = 'UserAuthorizationException';
  }
}

export class ConnectionLimitExceededException extends DomainException {
  constructor(
    public readonly userId: string,
    public readonly currentConnections: number,
    public readonly maxConnections: number
  ) {
    super(
      `Connection limit exceeded for user ${userId}`,
      'CONNECTION_LIMIT_EXCEEDED',
      { userId, currentConnections, maxConnections }
    );
    this.name = 'ConnectionLimitExceededException';
  }
}

export class MessageRateLimitExceededException extends DomainException {
  constructor(
    public readonly userId: string,
    public readonly timeWindow: number
  ) {
    super(
      `Message rate limit exceeded for user ${userId}`,
      'MESSAGE_RATE_LIMIT_EXCEEDED',
      { userId, timeWindow }
    );
    this.name = 'MessageRateLimitExceededException';
  }
}

export class InvalidTokenException extends DomainException {
  constructor(public readonly reason: string) {
    super(`Invalid token: ${reason}`, 'INVALID_TOKEN', { reason });
    this.name = 'InvalidTokenException';
  }
}

export class ServiceUnavailableException extends DomainException {
  constructor(
    public readonly serviceName: string,
    public readonly reason: string
  ) {
    super(
      `Service ${serviceName} unavailable: ${reason}`,
      'SERVICE_UNAVAILABLE',
      { serviceName, reason }
    );
    this.name = 'ServiceUnavailableException';
  }
}

export class CircuitBreakerOpenException extends DomainException {
  constructor(
    public readonly serviceName: string,
    public readonly operation: string
  ) {
    super(
      `Circuit breaker is open for ${serviceName}:${operation}`,
      'CIRCUIT_BREAKER_OPEN',
      { serviceName, operation }
    );
    this.name = 'CircuitBreakerOpenException';
  }
}
