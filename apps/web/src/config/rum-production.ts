import { logger } from '@awslambdahackathon/utils/frontend';
import { AwsRum } from 'aws-rum-web';

// Type definitions for Performance API
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceEventTiming extends PerformanceEntry {
  processingStart: number;
}

interface LayoutShift extends PerformanceEntry {
  value: number;
  hadRecentInput: boolean;
}

// Production RUM configuration
export const PRODUCTION_RUM_CONFIG = {
  // AWS RUM Application ID (from CloudWatch RUM console)
  applicationId: import.meta.env.VITE_AWS_RUM_APPLICATION_ID || '',

  // AWS RUM Application Version
  applicationVersion: import.meta.env.VITE_APP_VERSION || '1.0.0',

  // AWS RUM Application Region
  applicationRegion: import.meta.env.VITE_AWS_REGION || 'us-east-1',

  // Guest Role ARN (for authenticated users)
  guestRoleArn: import.meta.env.VITE_AWS_RUM_GUEST_ROLE_ARN || '',

  // Identity Pool ID (for authenticated users)
  identityPoolId: import.meta.env.VITE_AWS_RUM_IDENTITY_POOL_ID || '',

  // Telemetries to collect
  telemetries: ['performance', 'errors', 'http', 'interaction', 'user-session'],

  // Custom events to track
  customEvents: {
    // User interactions
    user_login: true,
    user_logout: true,
    message_sent: true,
    message_received: true,
    connection_established: true,
    connection_lost: true,

    // Performance events
    page_load: true,
    component_render: true,
    api_call: true,
    websocket_event: true,

    // Business events
    chat_session_start: true,
    chat_session_end: true,
    error_occurred: true,
    performance_degradation: true,
  },

  // Performance thresholds
  performanceThresholds: {
    // Page load time (ms)
    pageLoadTime: 3000,

    // First contentful paint (ms)
    firstContentfulPaint: 1500,

    // Largest contentful paint (ms)
    largestContentfulPaint: 2500,

    // Cumulative layout shift
    cumulativeLayoutShift: 0.1,

    // First input delay (ms)
    firstInputDelay: 100,

    // Time to interactive (ms)
    timeToInteractive: 3500,
  },

  // Error tracking configuration
  errorTracking: {
    // Capture unhandled errors
    captureUnhandledErrors: true,

    // Capture promise rejections
    capturePromiseRejections: true,

    // Capture console errors
    captureConsoleErrors: true,

    // Error sampling rate (0-1)
    samplingRate: 1.0,

    // Ignore specific error patterns
    ignoreErrors: [
      /Script error/,
      /ResizeObserver loop limit exceeded/,
      /Network request failed/,
    ],
  },

  // Session tracking
  sessionTracking: {
    // Session timeout (minutes)
    sessionTimeout: 30,

    // Track user interactions
    trackInteractions: true,

    // Track page views
    trackPageViews: true,

    // Track user journey
    trackUserJourney: true,
  },

  // Custom metrics
  customMetrics: {
    // WebSocket connection metrics
    websocketConnectionTime: true,
    websocketReconnectionAttempts: true,
    websocketMessageLatency: true,

    // Chat metrics
    messageResponseTime: true,
    chatSessionDuration: true,
    messagesPerSession: true,

    // Performance metrics
    componentRenderTime: true,
    memoryUsage: true,
    bundleLoadTime: true,
  },
};

// Initialize RUM for production
export const initializeProductionRUM = async (): Promise<AwsRum | null> => {
  try {
    // Check if RUM is already initialized
    if (window.AWS_RUM) {
      logger.info('RUM already initialized');
      return window.AWS_RUM;
    }

    // Validate required configuration
    if (!PRODUCTION_RUM_CONFIG.applicationId) {
      logger.warn('AWS RUM Application ID not configured');
      return null;
    }

    // Initialize AWS RUM
    const rum = new AwsRum(
      PRODUCTION_RUM_CONFIG.applicationId,
      PRODUCTION_RUM_CONFIG.applicationVersion,
      PRODUCTION_RUM_CONFIG.applicationRegion,
      {
        guestRoleArn: PRODUCTION_RUM_CONFIG.guestRoleArn,
        identityPoolId: PRODUCTION_RUM_CONFIG.identityPoolId,
        telemetries: PRODUCTION_RUM_CONFIG.telemetries,
        allowCookies: true,
        enableRumClient: true,
        sessionSampleRate: 1,
        dispatchInterval: 60000, // 1 minute
      }
    );

    // Store RUM instance globally
    window.AWS_RUM = rum;

    // Configure custom event tracking
    configureCustomEventTracking(rum);

    // Configure performance monitoring
    configurePerformanceMonitoring(rum);

    // Configure error tracking
    configureErrorTracking(rum);

    logger.info('Production RUM initialized successfully');
    return rum;
  } catch (error) {
    logger.error('Failed to initialize production RUM:', error);
    return null;
  }
};

// Configure custom event tracking
const configureCustomEventTracking = (rum: AwsRum) => {
  // Track user authentication events
  window.addEventListener('user-authenticated', ((event: CustomEvent) => {
    rum.recordEvent('user_login', {
      userId: event.detail.userId,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });
  }) as (event: Event) => void);

  // Track WebSocket events
  window.addEventListener('websocket-connected', ((event: CustomEvent) => {
    rum.recordEvent('connection_established', {
      connectionTime: event.detail.connectionTime,
      timestamp: new Date().toISOString(),
    });
  }) as (event: Event) => void);

  // Track message events
  window.addEventListener('message-sent', ((event: CustomEvent) => {
    rum.recordEvent('message_sent', {
      messageLength: event.detail.messageLength,
      timestamp: new Date().toISOString(),
    });
  }) as (event: Event) => void);

  // Track performance events
  window.addEventListener('performance-degradation', ((event: CustomEvent) => {
    rum.recordEvent('performance_degradation', {
      component: event.detail.component,
      renderTime: event.detail.renderTime,
      threshold: event.detail.threshold,
      timestamp: new Date().toISOString(),
    });
  }) as (event: Event) => void);
};

// Configure performance monitoring
const configurePerformanceMonitoring = (rum: AwsRum) => {
  // Monitor Core Web Vitals
  if ('PerformanceObserver' in window) {
    // Largest Contentful Paint
    const lcpObserver = new PerformanceObserver(list => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];

      if (lastEntry) {
        rum.recordEvent('largest_contentful_paint', {
          value: lastEntry.startTime,
          timestamp: new Date().toISOString(),
        });
      }
    });

    try {
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      logger.warn('LCP observer not supported');
    }

    // First Input Delay
    const fidObserver = new PerformanceObserver(list => {
      const entries = list.getEntries();

      entries.forEach(entry => {
        const firstInputEntry = entry as PerformanceEventTiming;
        rum.recordEvent('first_input_delay', {
          value: firstInputEntry.processingStart - firstInputEntry.startTime,
          timestamp: new Date().toISOString(),
        });
      });
    });

    try {
      fidObserver.observe({ entryTypes: ['first-input'] });
    } catch (e) {
      logger.warn('FID observer not supported');
    }

    // Cumulative Layout Shift
    const clsObserver = new PerformanceObserver(list => {
      let clsValue = 0;

      for (const entry of list.getEntries()) {
        const layoutShiftEntry = entry as LayoutShift;
        if (!layoutShiftEntry.hadRecentInput) {
          clsValue += layoutShiftEntry.value;
        }
      }

      rum.recordEvent('cumulative_layout_shift', {
        value: clsValue,
        timestamp: new Date().toISOString(),
      });
    });

    try {
      clsObserver.observe({ entryTypes: ['layout-shift'] });
    } catch (e) {
      logger.warn('CLS observer not supported');
    }
  }

  // Monitor memory usage
  if ('memory' in performance) {
    setInterval(() => {
      const memory = (
        performance as Performance & { memory: PerformanceMemory }
      ).memory;
      const memoryUsage = {
        used: memory.usedJSHeapSize / 1024 / 1024, // MB
        total: memory.totalJSHeapSize / 1024 / 1024, // MB
        limit: memory.jsHeapSizeLimit / 1024 / 1024, // MB
      };

      rum.recordEvent('memory_usage', {
        ...memoryUsage,
        timestamp: new Date().toISOString(),
      });
    }, 30000); // Every 30 seconds
  }
};

// Configure error tracking
const configureErrorTracking = (rum: AwsRum) => {
  // Track unhandled errors
  window.addEventListener('error', event => {
    const errorInfo = {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error?.stack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    rum.recordEvent('unhandled_error', errorInfo);
  });

  // Track unhandled promise rejections
  window.addEventListener('unhandledrejection', event => {
    const errorInfo = {
      reason: event.reason,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    rum.recordEvent('unhandled_promise_rejection', errorInfo);
  });

  // Track console errors
  /*const originalConsoleError = console.error;
  console.error = (...args) => {
    rum.recordEvent('console_error', {
      message: args.join(' '),
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    });

    originalConsoleError.apply(console, args);
  };*/
};

// Utility functions for custom metrics
export const recordCustomMetric = (
  metricName: string,
  value: number,
  metadata?: Record<string, unknown>
) => {
  if (window.AWS_RUM) {
    window.AWS_RUM.recordEvent(metricName, {
      value,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }
};

export const recordUserAction = (
  action: string,
  metadata?: Record<string, unknown>
) => {
  if (window.AWS_RUM) {
    window.AWS_RUM.recordEvent('user_action', {
      action,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }
};

// Type declarations
declare global {
  interface Window {
    AWS_RUM?: AwsRum;
  }
}
