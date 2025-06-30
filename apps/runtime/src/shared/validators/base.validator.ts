import { z } from 'zod';

/**
 * Validation result interface
 */
export interface ValidationResult<T> {
  /** Whether validation was successful */
  success: boolean;

  /** The validated data (only present if success is true) */
  data?: T;

  /** Error message (only present if success is false) */
  error?: string;

  /** Detailed error information */
  details?: unknown;

  /** Field-specific errors */
  fieldErrors?: Record<string, string[]>;

  /** Warnings that don't prevent validation success */
  warnings?: string[];
}

/**
 * Abstract base class for all validators
 * Provides common validation functionality using Zod schemas
 */
export abstract class BaseValidator<T> {
  protected abstract schema: z.ZodSchema<T>;

  /**
   * Validates data and returns a result object
   */
  validate(data: unknown): ValidationResult<T> {
    try {
      const validatedData = this.schema.parse(data);
      return {
        success: true,
        data: validatedData,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: 'Validation failed',
          details: error.errors,
          fieldErrors: this.formatFieldErrors(error),
        };
      }

      return {
        success: false,
        error: 'Unexpected validation error',
        details: error,
      };
    }
  }

  /**
   * Validates data and throws an error if validation fails
   */
  validateAndThrow(data: unknown): T {
    const result = this.validate(data);
    if (!result.success) {
      throw new ValidationError(result.error!, result.details);
    }
    return result.data!;
  }

  /**
   * Validates data safely, returning undefined if validation fails
   */
  validateSafe(data: unknown): T | undefined {
    const result = this.validate(data);
    return result.success ? result.data : undefined;
  }

  /**
   * Validates an array of data
   */
  validateArray(dataArray: unknown[]): ValidationResult<T[]> {
    const results: T[] = [];
    const errors: string[] = [];
    const fieldErrors: Record<string, string[]> = {};

    for (let i = 0; i < dataArray.length; i++) {
      const result = this.validate(dataArray[i]);
      if (result.success) {
        results.push(result.data!);
      } else {
        errors.push(`Item ${i}: ${result.error}`);
        if (result.fieldErrors) {
          fieldErrors[`item_${i}`] = Object.values(result.fieldErrors).flat();
        }
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        error: `Array validation failed: ${errors.join(', ')}`,
        fieldErrors,
      };
    }

    return {
      success: true,
      data: results,
    };
  }

  /**
   * Validates partial data (useful for updates)
   */
  validatePartial(data: unknown): ValidationResult<Partial<T>> {
    try {
      // Create a partial version of the schema
      const partialSchema =
        'partial' in this.schema && typeof this.schema.partial === 'function'
          ? this.schema.partial()
          : this.schema.optional();
      const validatedData = partialSchema.parse(data);
      return {
        success: true,
        data: validatedData,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: 'Partial validation failed',
          details: error.errors,
          fieldErrors: this.formatFieldErrors(error),
        };
      }

      return {
        success: false,
        error: 'Unexpected validation error',
        details: error,
      };
    }
  }

  /**
   * Formats Zod errors into field-specific error messages
   */
  private formatFieldErrors(error: z.ZodError): Record<string, string[]> {
    const fieldErrors: Record<string, string[]> = {};

    for (const issue of error.errors) {
      const path = issue.path.join('.');
      const field = path || 'root';

      if (!fieldErrors[field]) {
        fieldErrors[field] = [];
      }

      fieldErrors[field].push(issue.message);
    }

    return fieldErrors;
  }
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly details?: unknown,
    public readonly fieldErrors?: Record<string, string[]>
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Utility functions for common validation patterns
 */
export class ValidationUtils {
  /**
   * Creates a schema that validates required fields
   */
  static required<T extends Record<string, unknown>>(
    fields: (keyof T)[]
  ): z.ZodEffects<z.ZodType<T>, T, T> {
    return z.any().refine(
      (data: T) => {
        for (const field of fields) {
          if (
            data[field] === undefined ||
            data[field] === null ||
            data[field] === ''
          ) {
            return false;
          }
        }
        return true;
      },
      {
        message: `Required fields: ${fields.map(String).join(', ')}`,
      }
    );
  }

  /**
   * Creates a schema that validates string length
   */
  static stringLength(min: number, max: number, fieldName: string = 'field') {
    return z
      .string()
      .min(min, `${fieldName} must be at least ${min} characters`)
      .max(max, `${fieldName} must be no more than ${max} characters`);
  }

  /**
   * Creates a schema that validates email format
   */
  static email(fieldName: string = 'email') {
    return z.string().email(`${fieldName} must be a valid email address`);
  }

  /**
   * Creates a schema that validates URL format
   */
  static url(fieldName: string = 'url') {
    return z.string().url(`${fieldName} must be a valid URL`);
  }

  /**
   * Creates a schema that validates numeric range
   */
  static numberRange(min: number, max: number, fieldName: string = 'number') {
    return z
      .number()
      .min(min, `${fieldName} must be at least ${min}`)
      .max(max, `${fieldName} must be no more than ${max}`);
  }

  /**
   * Creates a schema that validates array length
   */
  static arrayLength(min: number, max: number, fieldName: string = 'array') {
    return z
      .array(z.any())
      .min(min, `${fieldName} must have at least ${min} items`)
      .max(max, `${fieldName} must have no more than ${max} items`);
  }

  /**
   * Creates a schema that validates date range
   */
  static dateRange(minDate?: Date, maxDate?: Date, fieldName: string = 'date') {
    let schema = z.date();

    if (minDate) {
      schema = schema.min(
        minDate,
        `${fieldName} must be after ${minDate.toISOString()}`
      );
    }

    if (maxDate) {
      schema = schema.max(
        maxDate,
        `${fieldName} must be before ${maxDate.toISOString()}`
      );
    }

    return schema;
  }
}
