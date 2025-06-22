import type { ApiResponse } from '@awslambdahackathon/types';

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

// API client functions
export const apiClient = {
  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    const response = await fetch(buildApiUrl(endpoint));
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
    const response = await fetch(buildApiUrl(endpoint), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
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
