import { describe, expect, it } from 'vitest';
import {
  capitalize,
  createErrorResponse,
  createSuccessResponse,
  generateId,
  isValidEmail,
  isValidUUID,
} from './index.js';

describe('Utils', () => {
  describe('HTTP Response Utils', () => {
    it('should create success response', () => {
      const data = { message: 'Hello World' };
      const response = createSuccessResponse(data);

      expect(response.statusCode).toBe(200);
      expect(response.headers).toBeDefined();
      expect(response.headers!['Content-Type']).toBe('application/json');
      expect(JSON.parse(response.body)).toEqual({
        success: true,
        data,
      });
    });

    it('should create error response', () => {
      const error = 'Something went wrong';
      const response = createErrorResponse(error, 400);

      expect(response.statusCode).toBe(400);
      expect(response.headers).toBeDefined();
      expect(response.headers!['Content-Type']).toBe('application/json');
      expect(JSON.parse(response.body)).toEqual({
        success: false,
        error,
      });
    });
  });

  describe('Validation Utils', () => {
    it('should validate email correctly', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('invalid-email')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
    });

    it('should validate UUID correctly', () => {
      const validUUID = '123e4567-e89b-12d3-a456-426614174000';
      const invalidUUID = 'invalid-uuid';

      expect(isValidUUID(validUUID)).toBe(true);
      expect(isValidUUID(invalidUUID)).toBe(false);
    });
  });

  describe('String Utils', () => {
    it('should capitalize string', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('WORLD')).toBe('World');
      expect(capitalize('test')).toBe('Test');
    });

    it('should generate unique ID', () => {
      const id1 = generateId();
      const id2 = generateId();

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });
  });
});
