import { logger } from '@awslambdahackathon/utils/frontend';
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

import {
  initializeProductionRUM,
  recordCustomMetric,
  recordUserAction,
} from '../config/rum-production';

interface RumContextType {
  trackEvent: (eventName: string, metadata?: Record<string, any>) => void;
  trackPageView: (pageName: string) => void;
  trackError: (error: Error, context?: string) => void;
  trackPerformance: (
    metricName: string,
    value: number,
    metadata?: Record<string, any>
  ) => void;
  trackUserAction: (action: string, metadata?: Record<string, any>) => void;
  isRumEnabled: boolean;
  isProduction: boolean;
}

const RumContext = createContext<RumContextType | undefined>(undefined);

interface RumProviderProps {
  children: ReactNode;
}

export const AwsRumProvider: React.FC<RumProviderProps> = ({ children }) => {
  const [isRumEnabled, setIsRumEnabled] = useState(false);
  const [isProduction, setIsProduction] = useState(false);

  useEffect(() => {
    const initializeRUM = async () => {
      try {
        // Check if we're in production
        const isProd = process.env.NODE_ENV === 'production';
        setIsProduction(isProd);

        if (isProd) {
          // Initialize production RUM
          const rum = await initializeProductionRUM();
          if (rum) {
            setIsRumEnabled(true);
            logger.info('Production RUM initialized successfully');
          } else {
            logger.warn('Failed to initialize production RUM');
          }
        } else {
          // Development mode - use console logging
          setIsRumEnabled(false);
          logger.info('RUM disabled in development mode');
        }
      } catch (error) {
        logger.error('Error initializing RUM:', error);
        setIsRumEnabled(false);
      }
    };

    initializeRUM();
  }, []);

  const trackEvent = (eventName: string, metadata?: Record<string, any>) => {
    try {
      if (isRumEnabled && window.AWS_RUM) {
        window.AWS_RUM.recordEvent(eventName, {
          timestamp: new Date().toISOString(),
          ...metadata,
        });
      } else {
        // Development logging
        logger.info(`[RUM Event] ${eventName}`, metadata);
      }
    } catch (error) {
      logger.error('Error tracking event:', error);
    }
  };

  const trackPageView = (pageName: string) => {
    try {
      if (isRumEnabled && window.AWS_RUM) {
        window.AWS_RUM.recordEvent('page_view', {
          pageName,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent,
        });
      } else {
        // Development logging
        logger.info(`[RUM Page View] ${pageName}`);
      }
    } catch (error) {
      logger.error('Error tracking page view:', error);
    }
  };

  const trackError = (error: Error, context?: string) => {
    try {
      if (isRumEnabled && window.AWS_RUM) {
        window.AWS_RUM.recordEvent('application_error', {
          message: error.message,
          stack: error.stack,
          context,
          timestamp: new Date().toISOString(),
          url: window.location.href,
          userAgent: navigator.userAgent,
        });
      } else {
        // Development logging
        logger.error(`[RUM Error] ${context || 'Application Error'}:`, error);
      }
    } catch (trackingError) {
      logger.error('Error tracking error:', trackingError);
    }
  };

  const trackPerformance = (
    metricName: string,
    value: number,
    metadata?: Record<string, any>
  ) => {
    try {
      if (isRumEnabled) {
        recordCustomMetric(metricName, value, metadata);
      } else {
        // Development logging
        logger.info(`[RUM Performance] ${metricName}: ${value}ms`, metadata);
      }
    } catch (error) {
      logger.error('Error tracking performance:', error);
    }
  };

  const trackUserAction = (action: string, metadata?: Record<string, any>) => {
    try {
      if (isRumEnabled) {
        recordUserAction(action, metadata);
      } else {
        // Development logging
        logger.info(`[RUM User Action] ${action}`, metadata);
      }
    } catch (error) {
      logger.error('Error tracking user action:', error);
    }
  };

  const contextValue: RumContextType = {
    trackEvent,
    trackPageView,
    trackError,
    trackPerformance,
    trackUserAction,
    isRumEnabled,
    isProduction,
  };

  return (
    <RumContext.Provider value={contextValue}>{children}</RumContext.Provider>
  );
};

export const useRumTracking = (): RumContextType => {
  const context = useContext(RumContext);
  if (!context) {
    throw new Error('useRumTracking must be used within an AwsRumProvider');
  }
  return context;
};

// Type declarations
declare global {
  interface Window {
    AWS_RUM?: import('aws-rum-web').AwsRum;
  }
}
