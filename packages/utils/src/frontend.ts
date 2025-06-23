/* eslint-disable no-console */
import { type AwsRum } from 'aws-rum-web';
import { z, ZodSchema } from 'zod';

declare global {
  interface Window {
    awsRum?: AwsRum;
  }
}

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
