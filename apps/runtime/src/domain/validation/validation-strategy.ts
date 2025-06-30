import { ConnectionStatus } from '@domain/entities/connection';
import { MessageStatus, MessageType } from '@domain/entities/message';
import { ValidationError } from '@domain/errors';

import {
  EntityValidationResult,
  FieldValidationResult,
} from './validation-result';

export interface ValidationRule<T> {
  validate(value: T): FieldValidationResult;
  getFieldName(): string | symbol;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface ValidationContext {
  entityName?: string;
  fieldName?: string;
  parentValue?: unknown;
  metadata?: Record<string, unknown>;
}

export interface ValidationStrategy<T> {
  validate(data: T, context?: ValidationContext): EntityValidationResult;
  validateField(
    fieldName: keyof T,
    value: T[keyof T],
    context?: ValidationContext
  ): FieldValidationResult;
  addRule(rule: ValidationRule<T>): void;
  removeRule(rule: ValidationRule<T>): void;
  clearRules(): void;
}

export class BaseValidationStrategy<T extends Record<string, unknown>>
  implements ValidationStrategy<T>
{
  protected rules: ValidationRule<T>[] = [];

  validate(data: T, context?: ValidationContext): EntityValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldResults: FieldValidationResult[] = [];

    // Add context information to errors if available
    const contextPrefix = context?.entityName ? `${context.entityName}: ` : '';

    // Run all rules
    for (const rule of this.rules) {
      const result = rule.validate(data);
      if (!result.isValid) {
        const contextualErrors = result.errors.map(
          error => `${contextPrefix}${error}`
        );
        errors.push(...contextualErrors);
      }
      if (result.warnings) {
        const contextualWarnings = result.warnings.map(
          warning => `${contextPrefix}${warning}`
        );
        warnings.push(...contextualWarnings);
      }
    }

    // Run field-specific validations
    for (const fieldName of Object.keys(data) as Array<keyof T>) {
      const fieldContext: ValidationContext = {
        ...context,
        fieldName: String(fieldName),
        parentValue: data,
      };
      const fieldResult = this.validateField(
        fieldName,
        data[fieldName],
        fieldContext
      );
      fieldResults.push(fieldResult);
      if (!fieldResult.isValid) {
        errors.push(...fieldResult.errors);
      }
      if (fieldResult.warnings) {
        warnings.push(...fieldResult.warnings);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
      fieldResults,
    };
  }

  validateField(
    fieldName: keyof T,
    value: T[keyof T],
    context?: ValidationContext
  ): FieldValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Create context-aware error prefix
    const contextPrefix = context?.entityName ? `${context.entityName}.` : '';
    const fieldPrefix = `${contextPrefix}${String(fieldName)}`;

    // Run field-specific rules
    for (const rule of this.rules) {
      // Only validate rules that apply to this field
      if (rule.getFieldName() === fieldName) {
        const result = rule.validate(value as T);
        if (!result.isValid) {
          const contextualErrors = result.errors.map(error =>
            error.includes(String(fieldName))
              ? error
              : `${fieldPrefix}: ${error}`
          );
          errors.push(...contextualErrors);
        }
        if (result.warnings) {
          const contextualWarnings = result.warnings.map(warning =>
            warning.includes(String(fieldName))
              ? warning
              : `${fieldPrefix}: ${warning}`
          );
          warnings.push(...contextualWarnings);
        }
      }
    }

    return {
      field: String(fieldName),
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  addRule(rule: ValidationRule<T>): void {
    this.rules.push(rule);
  }

  removeRule(rule: ValidationRule<T>): void {
    const index = this.rules.indexOf(rule);
    if (index > -1) {
      this.rules.splice(index, 1);
    }
  }

  clearRules(): void {
    this.rules = [];
  }

  validateAndThrow(data: T, context?: ValidationContext): void {
    const result = this.validate(data, context);
    if (!result.isValid) {
      const entityName = context?.entityName || 'Entity';
      throw new ValidationError(
        `${entityName} validation failed: ${result.errors.join(', ')}`,
        undefined,
        {
          fieldResults: result.fieldResults,
          warnings: result.warnings,
          context: context,
        }
      );
    }
  }
}

// Common validation rules
export class RequiredRule<T> implements ValidationRule<T> {
  constructor(private readonly fieldName: string | symbol) {}

  validate(value: T): FieldValidationResult {
    const fieldValue = this.getFieldValue(value);
    const isEmpty =
      fieldValue === null ||
      fieldValue === undefined ||
      (typeof fieldValue === 'string' && fieldValue.trim() === '');

    return {
      field: String(this.fieldName),
      isValid: !isEmpty,
      errors: isEmpty ? [this.getErrorMessage()] : [],
    };
  }

  getFieldName(): string | symbol {
    return this.fieldName;
  }

  private getFieldValue(value: T): unknown {
    if (typeof value === 'object' && value !== null) {
      return (value as Record<string | symbol, unknown>)[this.fieldName];
    }
    return value;
  }

  private getErrorMessage(): string {
    return `${String(this.fieldName)} is required`;
  }
}

export class MinLengthRule<T> implements ValidationRule<T> {
  constructor(
    private readonly fieldName: string | symbol,
    private readonly minLength: number
  ) {}

  validate(value: T): FieldValidationResult {
    const fieldValue = this.getFieldValue(value);
    const stringValue = String(fieldValue || '');
    const isValid = stringValue.length >= this.minLength;

    return {
      field: String(this.fieldName),
      isValid,
      errors: isValid ? [] : [this.getErrorMessage()],
    };
  }

  getFieldName(): string | symbol {
    return this.fieldName;
  }

  private getFieldValue(value: T): unknown {
    if (typeof value === 'object' && value !== null) {
      return (value as Record<string | symbol, unknown>)[this.fieldName];
    }
    return value;
  }

  private getErrorMessage(): string {
    return `${String(this.fieldName)} must be at least ${this.minLength} characters long`;
  }
}

export class MaxLengthRule<T> implements ValidationRule<T> {
  constructor(
    private readonly fieldName: string | symbol,
    private readonly maxLength: number
  ) {}

  validate(value: T): FieldValidationResult {
    const fieldValue = this.getFieldValue(value);
    const stringValue = String(fieldValue || '');
    const isValid = stringValue.length <= this.maxLength;

    return {
      field: String(this.fieldName),
      isValid,
      errors: isValid ? [] : [this.getErrorMessage()],
    };
  }

  getFieldName(): string | symbol {
    return this.fieldName;
  }

  private getFieldValue(value: T): unknown {
    if (typeof value === 'object' && value !== null) {
      return (value as Record<string | symbol, unknown>)[this.fieldName];
    }
    return value;
  }

  private getErrorMessage(): string {
    return `${String(this.fieldName)} must be no more than ${this.maxLength} characters long`;
  }
}

export class PatternRule<T> implements ValidationRule<T> {
  constructor(
    private readonly fieldName: string | symbol,
    private readonly pattern: RegExp,
    private readonly errorMessage?: string
  ) {}

  validate(value: T): FieldValidationResult {
    const fieldValue = this.getFieldValue(value);
    const stringValue = String(fieldValue || '');
    const isValid = this.pattern.test(stringValue);

    return {
      field: String(this.fieldName),
      isValid,
      errors: isValid ? [] : [this.getErrorMessage()],
    };
  }

  getFieldName(): string | symbol {
    return this.fieldName;
  }

  private getFieldValue(value: T): unknown {
    if (typeof value === 'object' && value !== null) {
      return (value as Record<string | symbol, unknown>)[this.fieldName];
    }
    return value;
  }

  private getErrorMessage(): string {
    return (
      this.errorMessage || `${String(this.fieldName)} has an invalid format`
    );
  }
}

interface UserValidationData extends Record<string, unknown> {
  username: string;
  groups?: string[];
  createdAt?: Date;
  lastActivityAt?: Date;
  isActive?: boolean;
}

interface MessageValidationData extends Record<string, unknown> {
  content: string;
  type: MessageType;
  userId: string;
  sessionId: string;
  status?: MessageStatus;
  createdAt?: Date;
  metadata?: Record<string, unknown>;
  replyToMessageId?: string;
}

interface ConnectionValidationData extends Record<string, unknown> {
  id: string;
  userId?: string | null;
  status: ConnectionStatus;
  connectedAt: Date;
  lastActivityAt?: Date;
  ttl?: number;
  metadata?: Record<string, unknown>;
}

export class ValidationFactory {
  static createUserValidationStrategy(): BaseValidationStrategy<UserValidationData> {
    const strategy = new BaseValidationStrategy<UserValidationData>();
    strategy.addRule(new RequiredRule('username'));
    strategy.addRule(new MinLengthRule('username', 3));
    strategy.addRule(new MaxLengthRule('username', 50));
    return strategy;
  }

  static createMessageValidationStrategy(): BaseValidationStrategy<MessageValidationData> {
    const strategy = new BaseValidationStrategy<MessageValidationData>();
    strategy.addRule(new RequiredRule('content'));
    strategy.addRule(new MinLengthRule('content', 1));
    strategy.addRule(new MaxLengthRule('content', 1000));
    strategy.addRule(new RequiredRule('userId'));
    strategy.addRule(new RequiredRule('sessionId'));
    return strategy;
  }

  static createConnectionValidationStrategy(): BaseValidationStrategy<ConnectionValidationData> {
    const strategy = new BaseValidationStrategy<ConnectionValidationData>();
    strategy.addRule(new RequiredRule('id'));
    strategy.addRule(new RequiredRule('status'));
    strategy.addRule(new RequiredRule('connectedAt'));
    strategy.addRule(
      new PatternRule(
        'connectedAt',
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/,
        'Invalid date format'
      )
    );
    return strategy;
  }
}
