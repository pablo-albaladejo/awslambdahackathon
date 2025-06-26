import { logger } from '@awslambdahackathon/utils/frontend';
import { AwsRum } from 'aws-rum-web';
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

// Type definitions
interface RumContextType {
  isInitialized: boolean;
  recordMetric: (
    metricName: string,
    value: number,
    metadata?: Record<string, unknown>
  ) => void;
  recordAction: (action: string, metadata?: Record<string, unknown>) => void;
  recordError: (error: Error, context?: Record<string, unknown>) => void;
  recordPerformance: (componentName: string, renderTime: number) => void;
}

interface RumProviderProps {
  children: ReactNode;
  userId?: string;
  sessionId?: string;
}

interface PerformanceData {
  componentName: string;
  renderTime: number;
  timestamp: number;
}

interface ErrorData {
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
  timestamp: number;
}

// Create context
const RumContext = createContext<RumContextType | undefined>(undefined);

// Performance tracking
const performanceData: PerformanceData[] = [];
const errorData: ErrorData[] = [];

// RUM Provider component
export const RumProvider: React.FC<RumProviderProps> = ({
  children,
  userId,
  sessionId,
}) => {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initializeRUM = async () => {
      try {
        const rum = await initializeProductionRUM();

        if (rum) {
          // Note: setUserId and setSessionId are not available in the current AwsRum API
          // User context can be set through recordEvent with user metadata
          if (userId || sessionId) {
            rum.recordEvent('user_context', {
              userId,
              sessionId,
              timestamp: new Date().toISOString(),
            });
          }

          setIsInitialized(true);
          logger.info('RUM context initialized successfully');
        } else {
          logger.warn(
            'RUM initialization failed, continuing without monitoring'
          );
        }
      } catch (error) {
        logger.error('Error initializing RUM context:', error);
      }
    };

    initializeRUM();
  }, [userId, sessionId]);

  // Record custom metric
  const recordMetric = (
    metricName: string,
    value: number,
    metadata?: Record<string, unknown>
  ) => {
    try {
      recordCustomMetric(metricName, value, metadata);

      // Store locally for debugging
      logger.debug('Metric recorded:', { metricName, value, metadata });
    } catch (error) {
      logger.error('Failed to record metric:', error);
    }
  };

  // Record user action
  const recordAction = (action: string, metadata?: Record<string, unknown>) => {
    try {
      recordUserAction(action, metadata);

      // Store locally for debugging
      logger.debug('Action recorded:', { action, metadata });
    } catch (error) {
      logger.error('Failed to record action:', error);
    }
  };

  // Record error
  const recordError = (error: Error, context?: Record<string, unknown>) => {
    try {
      const errorInfo: ErrorData = {
        message: error.message,
        stack: error.stack,
        context,
        timestamp: Date.now(),
      };

      // Store error locally
      errorData.push(errorInfo);

      // Keep only last 100 errors
      if (errorData.length > 100) {
        errorData.shift();
      }

      // Send to RUM
      if (window.AWS_RUM) {
        window.AWS_RUM.recordEvent('application_error', {
          message: error.message,
          stack: error.stack,
          context,
          timestamp: new Date().toISOString(),
        });
      }

      logger.error('Error recorded:', errorInfo);
    } catch (recordError) {
      logger.error('Failed to record error:', recordError);
    }
  };

  // Record performance data
  const recordPerformance = (componentName: string, renderTime: number) => {
    try {
      const perfData: PerformanceData = {
        componentName,
        renderTime,
        timestamp: Date.now(),
      };

      // Store performance data locally
      performanceData.push(perfData);

      // Keep only last 100 performance records
      if (performanceData.length > 100) {
        performanceData.shift();
      }

      // Send to RUM
      recordCustomMetric('component_render_time', renderTime, {
        component: componentName,
      });

      // Log slow renders
      if (renderTime > 16) {
        // 60fps threshold
        logger.warn('Slow component render detected:', {
          component: componentName,
          renderTime,
          threshold: 16,
        });
      }

      logger.debug('Performance recorded:', perfData);
    } catch (error) {
      logger.error('Failed to record performance:', error);
    }
  };

  const contextValue: RumContextType = {
    isInitialized,
    recordMetric,
    recordAction,
    recordError,
    recordPerformance,
  };

  return (
    <RumContext.Provider value={contextValue}>{children}</RumContext.Provider>
  );
};

// Custom hook to use RUM context
export const useRumTracking = (): RumContextType => {
  const context = useContext(RumContext);

  if (context === undefined) {
    throw new Error('useRumTracking must be used within a RumProvider');
  }

  return context;
};

// Type declarations
declare global {
  interface Window {
    AWS_RUM?: AwsRum;
  }
}
