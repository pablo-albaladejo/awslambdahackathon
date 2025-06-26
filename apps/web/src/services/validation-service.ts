import {
  type AuthMessage,
  type ChatMessage,
  createAuthMessage,
  createChatMessage,
  createErrorMessage,
  createPingMessage,
  validateAuthMessage,
  validateChatMessage,
  validateWebSocketMessage,
  type WebSocketMessage,
} from '@awslambdahackathon/types';
import { logger } from '@awslambdahackathon/utils/frontend';

// Validation result type
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

// WebSocket message validation service
export class WebSocketValidationService {
  /**
   * Validates a WebSocket message
   */
  static validateMessage(data: unknown): ValidationResult<WebSocketMessage> {
    try {
      const message = validateWebSocketMessage(data);
      return {
        success: true,
        data: message,
      };
    } catch (error) {
      logger.error('WebSocket message validation failed:', error);
      return {
        success: false,
        error: 'Invalid message format',
        details: error,
      };
    }
  }

  /**
   * Validates an authentication message
   */
  static validateAuthMessage(data: unknown): ValidationResult<AuthMessage> {
    try {
      const authMessage = validateAuthMessage(data);
      return {
        success: true,
        data: authMessage,
      };
    } catch (error) {
      logger.error('Auth message validation failed:', error);
      return {
        success: false,
        error: 'Invalid authentication message',
        details: error,
      };
    }
  }

  /**
   * Validates a chat message
   */
  static validateChatMessage(data: unknown): ValidationResult<ChatMessage> {
    try {
      const chatMessage = validateChatMessage(data);
      return {
        success: true,
        data: chatMessage,
      };
    } catch (error) {
      logger.error('Chat message validation failed:', error);
      return {
        success: false,
        error: 'Invalid chat message',
        details: error,
      };
    }
  }

  /**
   * Creates a validated authentication message
   */
  static createAuthMessage(token: string): WebSocketMessage {
    return createAuthMessage(token);
  }

  /**
   * Creates a validated chat message
   */
  static createChatMessage(
    message: string,
    sessionId?: string
  ): WebSocketMessage {
    return createChatMessage(message, sessionId);
  }

  /**
   * Creates a validated ping message
   */
  static createPingMessage(): WebSocketMessage {
    return createPingMessage();
  }

  /**
   * Creates a validated error message
   */
  static createErrorMessage(
    error: Error,
    code: string = 'UNKNOWN_ERROR'
  ): WebSocketMessage {
    return createErrorMessage(error, code);
  }

  /**
   * Validates message size limits
   */
  static validateMessageSize(
    message: string,
    maxSize: number = 10000
  ): ValidationResult<string> {
    if (message.length > maxSize) {
      return {
        success: false,
        error: `Message too large. Maximum size is ${maxSize} characters.`,
        details: { size: message.length, maxSize },
      };
    }

    return {
      success: true,
      data: message,
    };
  }

  /**
   * Validates message content (basic content filtering)
   */
  static validateMessageContent(message: string): ValidationResult<string> {
    // Check for empty or whitespace-only messages
    if (!message.trim()) {
      return {
        success: false,
        error: 'Message cannot be empty',
      };
    }

    // Check for excessive whitespace
    if (
      message.length > 1000 &&
      message.replace(/\s/g, '').length < message.length * 0.1
    ) {
      return {
        success: false,
        error: 'Message contains too much whitespace',
      };
    }

    // Check for repeated characters (potential spam)
    const repeatedCharRegex = /(.)\1{10,}/;
    if (repeatedCharRegex.test(message)) {
      return {
        success: false,
        error: 'Message contains too many repeated characters',
      };
    }

    return {
      success: true,
      data: message,
    };
  }

  /**
   * Comprehensive message validation
   */
  static validateCompleteMessage(
    message: string,
    sessionId?: string
  ): ValidationResult<WebSocketMessage> {
    // Validate message size
    const sizeValidation = this.validateMessageSize(message);
    if (!sizeValidation.success) {
      return {
        success: false,
        error: sizeValidation.error,
        details: sizeValidation.details,
      };
    }

    // Validate message content
    const contentValidation = this.validateMessageContent(message);
    if (!contentValidation.success) {
      return {
        success: false,
        error: contentValidation.error,
        details: contentValidation.details,
      };
    }

    // Create and validate the complete message
    try {
      const chatMessage = this.createChatMessage(message, sessionId);
      return {
        success: true,
        data: chatMessage,
      };
    } catch (error) {
      logger.error('Failed to create chat message:', error);
      return {
        success: false,
        error: 'Failed to create message',
        details: error,
      };
    }
  }
}

// Generic validation utilities
export class ValidationUtils {
  /**
   * Validates required fields
   */
  static validateRequired<T extends Record<string, unknown>>(
    data: T,
    requiredFields: (keyof T)[]
  ): ValidationResult<T> {
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      if (
        data[field] === undefined ||
        data[field] === null ||
        data[field] === ''
      ) {
        missingFields.push(String(field));
      }
    }

    if (missingFields.length > 0) {
      return {
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`,
        details: { missingFields },
      };
    }

    return {
      success: true,
      data,
    };
  }

  /**
   * Validates string length
   */
  static validateStringLength(
    value: string,
    minLength: number,
    maxLength: number,
    fieldName: string = 'value'
  ): ValidationResult<string> {
    if (value.length < minLength) {
      return {
        success: false,
        error: `${fieldName} must be at least ${minLength} characters long`,
        details: { length: value.length, minLength },
      };
    }

    if (value.length > maxLength) {
      return {
        success: false,
        error: `${fieldName} must be no more than ${maxLength} characters long`,
        details: { length: value.length, maxLength },
      };
    }

    return {
      success: true,
      data: value,
    };
  }

  /**
   * Validates email format
   */
  static validateEmail(email: string): ValidationResult<string> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return {
        success: false,
        error: 'Invalid email format',
        details: { email },
      };
    }

    return {
      success: true,
      data: email,
    };
  }

  /**
   * Validates URL format
   */
  static validateUrl(url: string): ValidationResult<string> {
    try {
      new URL(url);
      return {
        success: true,
        data: url,
      };
    } catch {
      return {
        success: false,
        error: 'Invalid URL format',
        details: { url },
      };
    }
  }

  /**
   * Validates numeric range
   */
  static validateNumericRange(
    value: number,
    min: number,
    max: number,
    fieldName: string = 'value'
  ): ValidationResult<number> {
    if (value < min || value > max) {
      return {
        success: false,
        error: `${fieldName} must be between ${min} and ${max}`,
        details: { value, min, max },
      };
    }

    return {
      success: true,
      data: value,
    };
  }
}

// Export the main validation service
export const webSocketValidation = WebSocketValidationService;
export const validationUtils = ValidationUtils;
