import { logger } from '@awslambdahackathon/utils/frontend';
import { useCallback } from 'react';

import { useAwsRum } from '../contexts/RumContext';

export const useRumTracking = () => {
  const { rum, isInitialized, error } = useAwsRum();

  const trackPageView = useCallback(
    (pagePath: string) => {
      if (rum && isInitialized) {
        try {
          rum.recordPageView(pagePath);
          logger.debug('RUM: Page view recorded', { pagePath });
        } catch (err) {
          logger.warn('RUM: Failed to record page view', { error: err });
        }
      }
    },
    [rum, isInitialized]
  );

  const trackError = useCallback(
    (error: Error, context?: string) => {
      if (rum && isInitialized) {
        try {
          rum.recordError(error);
          logger.debug('RUM: Error recorded', {
            error: error.message,
            context,
          });
        } catch (err) {
          logger.warn('RUM: Failed to record error', { error: err });
        }
      }
    },
    [rum, isInitialized]
  );

  const trackEvent = useCallback(
    (eventName: string, data: Record<string, unknown> = {}) => {
      if (rum && isInitialized) {
        try {
          rum.recordEvent(eventName, data);
          logger.debug('RUM: Event recorded', { eventName, data });
        } catch (err) {
          logger.warn('RUM: Failed to record event', { error: err });
        }
      }
    },
    [rum, isInitialized]
  );

  const setAuthenticatedUser = useCallback(
    (userId: string) => {
      if (rum && isInitialized && rum.setAuthenticatedUser) {
        try {
          rum.setAuthenticatedUser(userId);
          logger.debug('RUM: Authenticated user set', { userId });
        } catch (err) {
          logger.warn('RUM: Failed to set authenticated user', { error: err });
        }
      }
    },
    [rum, isInitialized]
  );

  const clearAuthenticatedUser = useCallback(() => {
    if (rum && isInitialized && rum.setAuthenticatedUser) {
      try {
        rum.setAuthenticatedUser(undefined);
        logger.debug('RUM: Authenticated user cleared');
      } catch (err) {
        logger.warn('RUM: Failed to clear authenticated user', { error: err });
      }
    }
  }, [rum, isInitialized]);

  const trackFormSubmit = useCallback(
    (formName: string, additionalData?: Record<string, unknown>) => {
      trackEvent('form_submit', {
        formName,
        pathname: window.location.pathname,
        ...additionalData,
      });
    },
    [trackEvent]
  );

  const trackApiCall = useCallback(
    (
      endpoint: string,
      method: string,
      success: boolean,
      responseTime?: number
    ) => {
      trackEvent('api_call', {
        endpoint,
        method,
        success,
        responseTime,
        pathname: window.location.pathname,
      });
    },
    [trackEvent]
  );

  const trackUserAction = useCallback(
    (action: string, additionalData?: Record<string, unknown>) => {
      trackEvent('user_action', {
        action,
        pathname: window.location.pathname,
        timestamp: new Date().toISOString(),
        ...additionalData,
      });
    },
    [trackEvent]
  );

  const trackButtonClick = useCallback(
    (buttonName: string, additionalData?: Record<string, unknown>) => {
      trackEvent('button_click', {
        buttonName,
        pathname: window.location.pathname,
        ...additionalData,
      });
    },
    [trackEvent]
  );

  return {
    trackPageView,
    trackError,
    trackEvent,
    setAuthenticatedUser,
    clearAuthenticatedUser,
    trackButtonClick,
    trackFormSubmit,
    trackApiCall,
    trackUserAction,
    isRumReady: isInitialized && !error && !!rum,
    rumError: error,
  };
};
