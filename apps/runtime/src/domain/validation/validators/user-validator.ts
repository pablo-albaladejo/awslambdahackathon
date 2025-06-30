import { ValidationError } from '@domain/errors';
import {
  EntityValidationResult,
  FieldValidationResult,
} from '@domain/validation/validation-result';

export interface UserData {
  id?: string;
  username: string;
  email: string;
  groups?: string[];
  createdAt?: Date;
  lastActivityAt?: Date;
  isActive?: boolean;
}

export class UserValidator {
  private static readonly USERNAME_MIN_LENGTH = 3;
  private static readonly USERNAME_MAX_LENGTH = 50;
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  static validate(userData: UserData): EntityValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldResults: FieldValidationResult[] = [];

    // Username validation
    const usernameResult = this.validateUsername(userData.username);
    fieldResults.push(usernameResult);
    errors.push(...usernameResult.errors);
    warnings.push(...(usernameResult.warnings || []));

    // Email validation
    const emailResult = this.validateEmail(userData.email);
    fieldResults.push(emailResult);
    errors.push(...emailResult.errors);

    // Groups validation
    const groupsResult = this.validateGroups(userData.groups);
    fieldResults.push(groupsResult);
    errors.push(...groupsResult.errors);

    // Date validation
    const dateResult = this.validateDates(
      userData.createdAt,
      userData.lastActivityAt
    );
    fieldResults.push(...dateResult);
    errors.push(...dateResult.flatMap(r => r.errors));

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
      fieldResults,
    };
  }

  static validateAndThrow(userData: UserData): void {
    const result = this.validate(userData);
    if (!result.isValid) {
      throw new ValidationError(
        `User validation failed: ${result.errors.join(', ')}`,
        undefined,
        { fieldResults: result.fieldResults, warnings: result.warnings }
      );
    }
  }

  private static validateUsername(username: string): FieldValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!username || username.trim().length === 0) {
      errors.push('Username cannot be empty');
    } else if (username.length < this.USERNAME_MIN_LENGTH) {
      errors.push(
        `Username must be at least ${this.USERNAME_MIN_LENGTH} characters long`
      );
    } else if (username.length > this.USERNAME_MAX_LENGTH) {
      errors.push(
        `Username cannot exceed ${this.USERNAME_MAX_LENGTH} characters`
      );
    }

    if (username && !/^[a-zA-Z0-9_-]+$/.test(username)) {
      warnings.push(
        'Username contains special characters. Consider using only letters, numbers, underscores, and hyphens.'
      );
    }

    return {
      field: 'username',
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  private static validateEmail(email: string): FieldValidationResult {
    const errors: string[] = [];

    if (!email || email.trim().length === 0) {
      errors.push('Email cannot be empty');
    } else if (!this.EMAIL_REGEX.test(email)) {
      errors.push('Invalid email format');
    }

    return {
      field: 'email',
      isValid: errors.length === 0,
      errors,
    };
  }

  private static validateGroups(groups?: string[]): FieldValidationResult {
    const errors: string[] = [];

    if (groups !== undefined && !Array.isArray(groups)) {
      errors.push('Groups must be an array');
    }

    return {
      field: 'groups',
      isValid: errors.length === 0,
      errors,
    };
  }

  private static validateDates(
    createdAt?: Date,
    lastActivityAt?: Date
  ): FieldValidationResult[] {
    const results: FieldValidationResult[] = [];
    const now = new Date();

    // Created date validation
    if (createdAt) {
      const createdResult: FieldValidationResult = {
        field: 'createdAt',
        isValid: true,
        errors: [],
      };

      if (createdAt > now) {
        createdResult.isValid = false;
        createdResult.errors.push('Created date cannot be in the future');
      }

      results.push(createdResult);
    }

    // Last activity date validation
    if (lastActivityAt) {
      const lastActivityResult: FieldValidationResult = {
        field: 'lastActivityAt',
        isValid: true,
        errors: [],
      };

      if (lastActivityAt > now) {
        lastActivityResult.isValid = false;
        lastActivityResult.errors.push(
          'Last activity date cannot be in the future'
        );
      }

      results.push(lastActivityResult);
    }

    return results;
  }

  static validateForUpdate(
    userData: Partial<UserData>
  ): EntityValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldResults: FieldValidationResult[] = [];

    // Only validate fields that are provided
    if (userData.username !== undefined) {
      const usernameResult = this.validateUsername(userData.username);
      fieldResults.push(usernameResult);
      errors.push(...usernameResult.errors);
      warnings.push(...(usernameResult.warnings || []));
    }

    if (userData.email !== undefined) {
      const emailResult = this.validateEmail(userData.email);
      fieldResults.push(emailResult);
      errors.push(...emailResult.errors);
    }

    if (userData.groups !== undefined) {
      const groupsResult = this.validateGroups(userData.groups);
      fieldResults.push(groupsResult);
      errors.push(...groupsResult.errors);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
      fieldResults,
    };
  }
}
