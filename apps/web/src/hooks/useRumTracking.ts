import { logger } from '@awslambdahackathon/utils/frontend';
import { useCallback } from 'react';

import { useAwsRum } from '../contexts/RumContext';

export const useRumTracking = () => {
  const { rum, isInitialized, error } = useAwsRum();

  const trackPageView = useCallback(() => {
    if (rum && isInitialized) {
      try {
        rum.recordPageView();
        logger.debug('RUM: Page view recorded');
      } catch (err) {
        logger.warn('RUM: Failed to record page view', { error: err });
      }
    }
  }, [rum, isInitialized]);

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

  return {
    trackPageView,
    trackError,
    trackEvent,
    setAuthenticatedUser,
    isRumReady: isInitialized && !error && !!rum,
    rumError: error,
  };
};
