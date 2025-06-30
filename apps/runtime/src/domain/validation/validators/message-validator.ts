import { MessageStatus, MessageType } from '@domain/entities/message';
import { ValidationError } from '@domain/errors';
import {
  EntityValidationResult,
  FieldValidationResult,
} from '@domain/validation/validation-result';

export interface MessageData {
  id?: string;
  content: string;
  type: MessageType;
  userId: string;
  sessionId: string;
  status?: MessageStatus;
  createdAt?: Date;
  metadata?: Record<string, unknown>;
  replyToMessageId?: string;
}

export class MessageValidator {
  private static readonly MAX_CONTENT_LENGTH = 10000; // 10KB
  private static readonly MIN_CONTENT_LENGTH = 1;

  static validate(messageData: MessageData): EntityValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldResults: FieldValidationResult[] = [];

    // Content validation
    const contentResult = this.validateContent(messageData.content);
    fieldResults.push(contentResult);
    errors.push(...contentResult.errors);
    warnings.push(...(contentResult.warnings || []));

    // Type validation
    const typeResult = this.validateType(messageData.type);
    fieldResults.push(typeResult);
    errors.push(...typeResult.errors);

    // User ID validation
    const userIdResult = this.validateUserId(messageData.userId);
    fieldResults.push(userIdResult);
    errors.push(...userIdResult.errors);

    // Session ID validation
    const sessionIdResult = this.validateSessionId(messageData.sessionId);
    fieldResults.push(sessionIdResult);
    errors.push(...sessionIdResult.errors);

    // Metadata validation
    const metadataResult = this.validateMetadata(messageData.metadata);
    fieldResults.push(metadataResult);
    errors.push(...metadataResult.errors);

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
      fieldResults,
    };
  }

  static validateAndThrow(messageData: MessageData): void {
    const result = this.validate(messageData);
    if (!result.isValid) {
      throw new ValidationError(
        `Message validation failed: ${result.errors.join(', ')}`,
        undefined,
        { fieldResults: result.fieldResults, warnings: result.warnings }
      );
    }
  }

  private static validateContent(content: string): FieldValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!content || content.trim().length === 0) {
      errors.push('Message content cannot be empty');
    } else if (content.length < this.MIN_CONTENT_LENGTH) {
      errors.push(
        `Message content must be at least ${this.MIN_CONTENT_LENGTH} character long`
      );
    } else if (content.length > this.MAX_CONTENT_LENGTH) {
      errors.push(
        `Message content cannot exceed ${this.MAX_CONTENT_LENGTH} characters`
      );
    }

    // Check for potentially problematic content
    if (content.includes('<script>') || content.includes('javascript:')) {
      warnings.push('Message content contains potentially unsafe content');
    }

    return {
      field: 'content',
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  private static validateType(type: MessageType): FieldValidationResult {
    const errors: string[] = [];
    const validTypes = Object.values(MessageType);

    if (!validTypes.includes(type)) {
      errors.push(
        `Invalid message type. Must be one of: ${validTypes.join(', ')}`
      );
    }

    return {
      field: 'type',
      isValid: errors.length === 0,
      errors,
    };
  }

  private static validateUserId(userId: string): FieldValidationResult {
    const errors: string[] = [];

    if (!userId || userId.trim().length === 0) {
      errors.push('User ID cannot be empty');
    }

    return {
      field: 'userId',
      isValid: errors.length === 0,
      errors,
    };
  }

  private static validateSessionId(sessionId: string): FieldValidationResult {
    const errors: string[] = [];

    if (!sessionId || sessionId.trim().length === 0) {
      errors.push('Session ID cannot be empty');
    }

    return {
      field: 'sessionId',
      isValid: errors.length === 0,
      errors,
    };
  }

  private static validateMetadata(
    metadata?: Record<string, unknown>
  ): FieldValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (metadata !== undefined) {
      if (typeof metadata !== 'object' || metadata === null) {
        errors.push('Metadata must be an object');
      } else {
        // Check for large metadata objects
        const metadataSize = JSON.stringify(metadata).length;
        if (metadataSize > 1000) {
          warnings.push('Metadata object is large and may impact performance');
        }

        // Check for potentially sensitive keys
        const sensitiveKeys = ['password', 'token', 'secret', 'key'];
        const hasSensitiveKeys = Object.keys(metadata).some(key =>
          sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))
        );
        if (hasSensitiveKeys) {
          warnings.push('Metadata contains potentially sensitive information');
        }
      }
    }

    return {
      field: 'metadata',
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  static validateForUpdate(
    messageData: Partial<MessageData>
  ): EntityValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldResults: FieldValidationResult[] = [];

    // Only validate fields that are provided
    if (messageData.content !== undefined) {
      const contentResult = this.validateContent(messageData.content);
      fieldResults.push(contentResult);
      errors.push(...contentResult.errors);
      warnings.push(...(contentResult.warnings || []));
    }

    if (messageData.type !== undefined) {
      const typeResult = this.validateType(messageData.type);
      fieldResults.push(typeResult);
      errors.push(...typeResult.errors);
    }

    if (messageData.metadata !== undefined) {
      const metadataResult = this.validateMetadata(messageData.metadata);
      fieldResults.push(metadataResult);
      errors.push(...metadataResult.errors);
      warnings.push(...(metadataResult.warnings || []));
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings: warnings.length > 0 ? warnings : undefined,
      fieldResults,
    };
  }
}
