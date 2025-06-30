import { DomainError } from './domain-errors';

export class ValidationError extends DomainError {
  constructor(errors: Record<string, unknown>) {
    super('Validation failed', 'VALIDATION_ERROR', {
      validationErrors: errors,
    });
  }
}

export class AuthenticationError extends DomainError {
  constructor(message: string, userId?: string) {
    super(message, 'AUTHENTICATION_ERROR', { userId });
  }
}

export class AuthorizationError extends DomainError {
  constructor(message: string, userId: string, requiredPermissions: string[]) {
    super(message, 'AUTHORIZATION_ERROR', { userId, requiredPermissions });
  }
}

export class ResourceNotFoundError extends DomainError {
  constructor(resourceType: string, identifier: string) {
    super(
      `${resourceType} with identifier '${identifier}' not found`,
      'NOT_FOUND',
      { resourceType, identifier }
    );
  }
}

export class ResourceConflictError extends DomainError {
  constructor(resourceType: string, identifier: string, version?: string) {
    super(
      `${resourceType} with identifier '${identifier}' has a conflict`,
      'CONFLICT',
      { resourceType, identifier, version }
    );
  }
}

export class BusinessRuleViolationError extends DomainError {
  constructor(
    message: string,
    rule: string,
    context?: Record<string, unknown>
  ) {
    super(message, 'INTERNAL_ERROR', { rule, ...context });
  }
}

export class InfrastructureError extends DomainError {
  constructor(
    message: string,
    service: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'INTERNAL_ERROR', { service, ...details });
  }
}
