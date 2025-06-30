import { DomainError, ErrorResponse, Result } from '@awslambdahackathon/types';

// Web app can now use shared error types for API responses
export function handleApiError(error: ErrorResponse): string {
  switch (error.error.code) {
    case 'AUTHENTICATION_ERROR':
      return 'Please log in to continue';
    case 'AUTHORIZATION_ERROR':
      return 'You do not have permission to perform this action';
    case 'VALIDATION_ERROR':
      return 'Please check your input and try again';
    case 'NOT_FOUND':
      return 'The requested resource was not found';
    case 'RATE_LIMIT_ERROR':
      return 'You are making requests too quickly. Please slow down';
    case 'SERVICE_UNAVAILABLE':
      return 'Service is temporarily unavailable. Please try again later';
    default:
      return 'An unexpected error occurred';
  }
}

// Example of using Result type for safer error handling
export async function safeApiCall<T>(
  apiCall: () => Promise<T>
): Promise<Result<T, ErrorResponse>> {
  try {
    const data = await apiCall();
    return { success: true, data };
  } catch (error) {
    if (error instanceof DomainError) {
      const errorResponse: ErrorResponse = {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          correlationId: error.correlationId,
          timestamp: new Date().toISOString(),
        },
      };
      return { success: false, error: errorResponse };
    }

    // Handle non-domain errors
    const genericError: ErrorResponse = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
      },
    };
    return { success: false, error: genericError };
  }
}
