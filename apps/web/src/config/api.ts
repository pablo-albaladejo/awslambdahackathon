import type { ApiResponse } from '@awslambdahackathon/types';
import { logger } from '@awslambdahackathon/utils/frontend';
import { fetchAuthSession } from 'aws-amplify/auth';

// API configuration
export const API_CONFIG = {
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  endpoints: {
    health: '/health',
  },
} as const;

// Helper function to build full API URLs
export const buildApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.baseUrl}${endpoint}`;
};

// Helper function to get auth headers
const getAuthHeaders = async (): Promise<Record<string, string>> => {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();

    if (token) {
      return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
    }
  } catch (error) {
    logger.warn('Failed to get auth token', { error });
  }

  return {
    'Content-Type': 'application/json',
  };
};

// API client functions
export const apiClient = {
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    const headers = await getAuthHeaders();

    const response = await fetch(buildApiUrl(endpoint), {
      method: 'GET',
      headers,
      credentials: 'include', // Include cookies for CORS
    });

    if (!response.ok) {
      // Try to parse error from body
      try {
        const errorBody = await response.json();
        return (
          errorBody || {
            success: false,
            error: `API Error: ${response.status}`,
          }
        );
      } catch (e: unknown) {
        return { success: false, error: `API Error: ${response.status}` };
      }
    }
    return response.json();
  },

  async post<T>(endpoint: string, data: unknown): Promise<ApiResponse<T>> {
    const headers = await getAuthHeaders();

    const response = await fetch(buildApiUrl(endpoint), {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
      credentials: 'include', // Include cookies for CORS
    });

    if (!response.ok) {
      try {
        const errorBody = await response.json();
        return (
          errorBody || {
            success: false,
            error: `API Error: ${response.status}`,
          }
        );
      } catch (e: unknown) {
        return { success: false, error: `API Error: ${response.status}` };
      }
    }
    return response.json();
  },
};
