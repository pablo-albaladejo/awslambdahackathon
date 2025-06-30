import { ConnectionStatus } from '@domain/entities/connection';
import { MessageStatus, MessageType } from '@domain/entities/message';
import { ValidationError } from '@domain/errors';

import {
  EntityValidationResult,
  FieldValidationResult,
} from './validation-result';

export interface ValidationRule<T> {
  validate(value: T, context?: ValidationContext): ValidationResult;
  getErrorMessage(): string;
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

    // Run all rules
    for (const rule of this.rules) {
      const result = rule.validate(data, context);
      if (!result.isValid) {
        errors.push(...result.errors);
      }
      if (result.warnings) {
        warnings.push(...result.warnings);
      }
    }

    // Run field-specific validations
    for (const fieldName of Object.keys(data) as Array<keyof T>) {
      const fieldResult = this.validateField(fieldName, data[fieldName], {
        ...context,
        fieldName: String(fieldName),
        parentValue: data,
      });
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

    // Run field-specific rules
    for (const rule of this.rules) {
      const result = rule.validate(value as T, {
        ...context,
        fieldName: String(fieldName),
      });
      if (!result.isValid) {
        errors.push(...result.errors);
      }
      if (result.warnings) {
        warnings.push(...result.warnings);
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
      throw new ValidationError(
        `Validation failed: ${result.errors.join(', ')}`,
        undefined,
        { fieldResults: result.fieldResults, warnings: result.warnings }
      );
    }
  }
}

// Common validation rules
export class RequiredRule<T> implements ValidationRule<T> {
  constructor(private fieldName: keyof T) {}

  validate(value: T): ValidationResult {
    const fieldValue = value[this.fieldName];
    const isValid =
      fieldValue !== null && fieldValue !== undefined && fieldValue !== '';

    return {
      isValid,
      errors: isValid ? [] : [this.getErrorMessage()],
    };
  }

  getErrorMessage(): string {
    return `${String(this.fieldName)} is required`;
  }
}

export class StringLengthRule<T> implements ValidationRule<T> {
  constructor(
    private fieldName: keyof T,
    private minLength: number,
    private maxLength: number
  ) {}

  validate(value: T): ValidationResult {
    const fieldValue = value[this.fieldName];
    if (typeof fieldValue !== 'string') {
      return {
        isValid: false,
        errors: [`${String(this.fieldName)} must be a string`],
      };
    }

    const length = fieldValue.length;
    const isValid = length >= this.minLength && length <= this.maxLength;

    return {
      isValid,
      errors: isValid ? [] : [this.getErrorMessage()],
    };
  }

  getErrorMessage(): string {
    return `${String(this.fieldName)} must be between ${this.minLength} and ${this.maxLength} characters`;
  }
}

export class EmailRule<T> implements ValidationRule<T> {
  constructor(private fieldName: keyof T) {}

  validate(value: T): ValidationResult {
    const fieldValue = value[this.fieldName];
    if (typeof fieldValue !== 'string') {
      return {
        isValid: false,
        errors: [`${String(this.fieldName)} must be a string`],
      };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isValid = emailRegex.test(fieldValue);

    return {
      isValid,
      errors: isValid ? [] : [this.getErrorMessage()],
    };
  }

  getErrorMessage(): string {
    return `${String(this.fieldName)} must be a valid email address`;
  }
}

export class ArrayRule<T> implements ValidationRule<T> {
  constructor(
    private fieldName: keyof T,
    private minItems?: number,
    private maxItems?: number
  ) {}

  validate(value: T): ValidationResult {
    const fieldValue = value[this.fieldName];
    if (!Array.isArray(fieldValue)) {
      return {
        isValid: false,
        errors: [`${String(this.fieldName)} must be an array`],
      };
    }

    const length = fieldValue.length;
    let isValid = true;
    const errors: string[] = [];

    if (this.minItems !== undefined && length < this.minItems) {
      isValid = false;
      errors.push(
        `${String(this.fieldName)} must have at least ${this.minItems} items`
      );
    }

    if (this.maxItems !== undefined && length > this.maxItems) {
      isValid = false;
      errors.push(
        `${String(this.fieldName)} must have at most ${this.maxItems} items`
      );
    }

    return {
      isValid,
      errors,
    };
  }

  getErrorMessage(): string {
    return `${String(this.fieldName)} array validation failed`;
  }
}

export class DateRule<T> implements ValidationRule<T> {
  constructor(
    private fieldName: keyof T,
    private allowFuture: boolean = false
  ) {}

  validate(value: T): ValidationResult {
    const fieldValue = value[this.fieldName];
    if (!(fieldValue instanceof Date)) {
      return {
        isValid: false,
        errors: [`${String(this.fieldName)} must be a valid date`],
      };
    }

    const now = new Date();
    const isValid = this.allowFuture || fieldValue <= now;

    return {
      isValid,
      errors: isValid ? [] : [this.getErrorMessage()],
    };
  }

  getErrorMessage(): string {
    return `${String(this.fieldName)} cannot be in the future`;
  }
}

interface UserValidationData extends Record<string, unknown> {
  username: string;
  email: string;
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
    strategy.addRule(new StringLengthRule('username', 3, 50));
    strategy.addRule(new RequiredRule('email'));
    strategy.addRule(new EmailRule('email'));
    return strategy;
  }

  static createMessageValidationStrategy(): BaseValidationStrategy<MessageValidationData> {
    const strategy = new BaseValidationStrategy<MessageValidationData>();
    strategy.addRule(new RequiredRule('content'));
    strategy.addRule(new StringLengthRule('content', 1, 1000));
    strategy.addRule(new RequiredRule('userId'));
    strategy.addRule(new RequiredRule('sessionId'));
    return strategy;
  }

  static createConnectionValidationStrategy(): BaseValidationStrategy<ConnectionValidationData> {
    const strategy = new BaseValidationStrategy<ConnectionValidationData>();
    strategy.addRule(new RequiredRule('id'));
    strategy.addRule(new RequiredRule('status'));
    strategy.addRule(new RequiredRule('connectedAt'));
    strategy.addRule(new DateRule('connectedAt', false));
    return strategy;
  }
}
