import { ValidationError } from '@domain/errors';

import {
  EntityValidationResult,
  FieldValidationResult,
} from '../validation-result';

export interface UserData {
  username: string;
  groups?: string[];
  createdAt?: Date;
  lastActivityAt?: Date;
  isActive?: boolean;
}

export class UserValidator {
  private static readonly USERNAME_MIN_LENGTH = 3;
  private static readonly USERNAME_MAX_LENGTH = 50;

  static validate(userData: UserData): EntityValidationResult {
    const errors: string[] = [];
    const fieldResults: FieldValidationResult[] = [];

    // Username validation
    const usernameResult = this.validateUsername(userData.username);
    fieldResults.push(usernameResult);
    errors.push(...usernameResult.errors);

    // Groups validation
    if (userData.groups !== undefined) {
      const groupsResult = this.validateGroups(userData.groups);
      fieldResults.push(groupsResult);
      errors.push(...groupsResult.errors);
    }

    // CreatedAt validation
    if (userData.createdAt !== undefined) {
      const createdAtResult = this.validateCreatedAt(userData.createdAt);
      fieldResults.push(createdAtResult);
      errors.push(...createdAtResult.errors);
    }

    // LastActivityAt validation
    if (
      userData.lastActivityAt !== undefined &&
      userData.createdAt !== undefined
    ) {
      const lastActivityResult = this.validateLastActivityAt(
        userData.lastActivityAt,
        userData.createdAt
      );
      fieldResults.push(lastActivityResult);
      errors.push(...lastActivityResult.errors);
    }

    return {
      isValid: errors.length === 0,
      errors,
      fieldResults,
    };
  }

  static validateAndThrow(userData: UserData): void {
    const result = this.validate(userData);
    if (!result.isValid) {
      throw new ValidationError(
        `User validation failed: ${result.errors.join(', ')}`,
        undefined,
        { fieldResults: result.fieldResults }
      );
    }
  }

  private static validateUsername(username: string): FieldValidationResult {
    const errors: string[] = [];

    if (!username || username.trim().length === 0) {
      errors.push('Username cannot be empty');
    } else if (username.length < this.USERNAME_MIN_LENGTH) {
      errors.push(
        `Username must be at least ${this.USERNAME_MIN_LENGTH} characters long`
      );
    } else if (username.length > this.USERNAME_MAX_LENGTH) {
      errors.push(
        `Username must be no more than ${this.USERNAME_MAX_LENGTH} characters long`
      );
    }

    return {
      field: 'username',
      isValid: errors.length === 0,
      errors,
    };
  }

  private static validateGroups(groups: string[]): FieldValidationResult {
    const errors: string[] = [];

    if (!groups || groups.length === 0) {
      errors.push('User must belong to at least one group');
    } else {
      const validGroups = ['admin', 'user', 'guest', 'moderator', 'banned'];
      const invalidGroups = groups.filter(
        group => !validGroups.includes(group)
      );
      if (invalidGroups.length > 0) {
        errors.push(`Invalid groups: ${invalidGroups.join(', ')}`);
      }
    }

    return {
      field: 'groups',
      isValid: errors.length === 0,
      errors,
    };
  }

  private static validateCreatedAt(createdAt: Date): FieldValidationResult {
    const errors: string[] = [];

    if (!(createdAt instanceof Date) || isNaN(createdAt.getTime())) {
      errors.push('CreatedAt must be a valid date');
    } else if (createdAt > new Date()) {
      errors.push('CreatedAt cannot be in the future');
    }

    return {
      field: 'createdAt',
      isValid: errors.length === 0,
      errors,
    };
  }

  private static validateLastActivityAt(
    lastActivityAt: Date,
    createdAt: Date
  ): FieldValidationResult {
    const errors: string[] = [];

    if (!(lastActivityAt instanceof Date) || isNaN(lastActivityAt.getTime())) {
      errors.push('LastActivityAt must be a valid date');
    } else if (lastActivityAt < createdAt) {
      errors.push('LastActivityAt cannot be before createdAt');
    }

    return {
      field: 'lastActivityAt',
      isValid: errors.length === 0,
      errors,
    };
  }

  static validateUpdate(userData: Partial<UserData>): EntityValidationResult {
    const errors: string[] = [];
    const fieldResults: FieldValidationResult[] = [];

    // Username validation (if provided)
    if (userData.username !== undefined) {
      const usernameResult = this.validateUsername(userData.username);
      fieldResults.push(usernameResult);
      errors.push(...usernameResult.errors);
    }

    // Groups validation (if provided)
    if (userData.groups !== undefined) {
      const groupsResult = this.validateGroups(userData.groups);
      fieldResults.push(groupsResult);
      errors.push(...groupsResult.errors);
    }

    // CreatedAt validation (if provided)
    if (userData.createdAt !== undefined) {
      const createdAtResult = this.validateCreatedAt(userData.createdAt);
      fieldResults.push(createdAtResult);
      errors.push(...createdAtResult.errors);
    }

    // LastActivityAt validation (if provided)
    if (
      userData.lastActivityAt !== undefined &&
      userData.createdAt !== undefined
    ) {
      const lastActivityResult = this.validateLastActivityAt(
        userData.lastActivityAt,
        userData.createdAt
      );
      fieldResults.push(lastActivityResult);
      errors.push(...lastActivityResult.errors);
    }

    return {
      isValid: errors.length === 0,
      errors,
      fieldResults,
    };
  }
}
