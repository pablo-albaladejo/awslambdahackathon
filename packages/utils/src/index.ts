/* eslint-disable no-console */
import type { ApiResponse, LambdaResponse } from '@awslambdahackathon/types';
import { z, ZodSchema } from 'zod';

// Define LogLevel type locally
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

// Extend the Window interface to include awsRum
interface AwsRum {
  recordEvent: (eventName: string, data: unknown) => void;
}

declare global {
  interface Window {
    awsRum?: AwsRum;
  }
}

const defaultHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

// HTTP response utilities
export const createSuccessResponse = <T>(
  data: T,
  statusCode: number = 200
): LambdaResponse => ({
  statusCode,
  headers: defaultHeaders,
  body: JSON.stringify({
    success: true,
    data,
  } as ApiResponse<T>),
});

export const createErrorResponse = (
  error: string,
  statusCode: number = 500
): LambdaResponse => ({
  statusCode,
  headers: defaultHeaders,
  body: JSON.stringify({
    success: false,
    error,
  } as ApiResponse),
});

// Validation utilities
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// String utilities
export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const generateId = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

// Frontend logger with CloudWatch RUM support
export const logger = {
  info: (message: string, data?: unknown) => {
    if (typeof window !== 'undefined') {
      // Try to use CloudWatch RUM if available
      if (window.awsRum) {
        window.awsRum.recordEvent('info', {
          message,
          data,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.log(`[INFO] ${message}`, data);
      }
    }
  },
  error: (message: string, data?: unknown) => {
    if (typeof window !== 'undefined') {
      // Try to use CloudWatch RUM if available
      if (window.awsRum) {
        window.awsRum.recordEvent('error', {
          message,
          data,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.error(`[ERROR] ${message}`, data);
      }
    }
  },
  warn: (message: string, data?: unknown) => {
    if (typeof window !== 'undefined') {
      // Try to use CloudWatch RUM if available
      if (window.awsRum) {
        window.awsRum.recordEvent('warn', {
          message,
          data,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.warn(`[WARN] ${message}`, data);
      }
    }
  },
  debug: (message: string, data?: unknown) => {
    if (typeof window !== 'undefined') {
      // Try to use CloudWatch RUM if available
      if (window.awsRum) {
        window.awsRum.recordEvent('debug', {
          message,
          data,
          timestamp: new Date().toISOString(),
        });
      } else {
        console.debug(`[DEBUG] ${message}`, data);
      }
    }
  },
};

// Export Zod utilities for frontend use
export { z, ZodSchema };

// Export Lambda utilities (backend only)
export * from './lambda';
