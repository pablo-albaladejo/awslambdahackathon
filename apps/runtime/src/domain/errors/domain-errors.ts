export abstract class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly field?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends DomainError {
  constructor(
    message: string,
    field?: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'VALIDATION_ERROR', field, details);
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
      'ENTITY_NOT_FOUND',
      undefined,
      { entityType, identifier, ...details }
    );
  }
}

export class AuthenticationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'AUTHENTICATION_ERROR', undefined, details);
  }
}

export class AuthorizationError extends DomainError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'AUTHORIZATION_ERROR', undefined, details);
  }
}

export class BusinessRuleViolationError extends DomainError {
  constructor(
    message: string,
    ruleName: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'BUSINESS_RULE_VIOLATION', undefined, {
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
    super(message, 'CONNECTION_ERROR', undefined, {
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
    super(message, 'MESSAGE_ERROR', undefined, {
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
    super(message, 'INFRASTRUCTURE_ERROR', undefined, {
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
    super(message, 'RATE_LIMIT_ERROR', undefined, {
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
      undefined,
      { service, state, ...details }
    );
  }
}
