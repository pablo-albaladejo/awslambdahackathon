import type { ApiResponse, LambdaResponse } from '@awslambdahackathon/types';

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
