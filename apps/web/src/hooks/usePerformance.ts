import { logger } from '@awslambdahackathon/utils/frontend';
import { useCallback, useEffect, useRef } from 'react';

interface PerformanceMetrics {
  renderTime: number;
  memoryUsage?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
  timestamp: number;
}

interface UsePerformanceOptions {
  componentName: string;
  logRenderTime?: boolean;
  logMemoryUsage?: boolean;
  threshold?: number; // ms threshold for slow renders
}

export const usePerformance = (options: UsePerformanceOptions) => {
  const {
    componentName,
    logRenderTime = true,
    logMemoryUsage = false,
    threshold = 16, // 16ms = 60fps
  } = options;

  const renderStartTime = useRef<number>(0);
  const renderCount = useRef<number>(0);
  const metricsRef = useRef<PerformanceMetrics[]>([]);

  // Track render start
  useEffect(() => {
    renderStartTime.current = performance.now();
    renderCount.current += 1;
  });

  // Track render end and performance
  useEffect(() => {
    const renderTime = performance.now() - renderStartTime.current;
    const timestamp = Date.now();

    const metrics: PerformanceMetrics = {
      renderTime,
      timestamp,
    };

    // Get memory usage if available
    if (logMemoryUsage && 'memory' in performance) {
      const memory = (performance as any).memory;
      metrics.memoryUsage = {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
      };
    }

    metricsRef.current.push(metrics);

    // Log performance metrics
    if (logRenderTime) {
      const isSlow = renderTime > threshold;
      const logLevel = isSlow ? 'warn' : 'info';

      logger[logLevel](`${componentName} render performance`, {
        renderTime: `${renderTime.toFixed(2)}ms`,
        renderCount: renderCount.current,
        isSlow,
        threshold: `${threshold}ms`,
        ...(logMemoryUsage &&
          metrics.memoryUsage && {
            memoryUsage: {
              used: `${(metrics.memoryUsage.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
              total: `${(metrics.memoryUsage.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
              limit: `${(metrics.memoryUsage.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`,
            },
          }),
      });
    }

    // Keep only last 100 metrics to prevent memory leaks
    if (metricsRef.current.length > 100) {
      metricsRef.current = metricsRef.current.slice(-100);
    }
  });

  // Get performance statistics
  const getPerformanceStats = useCallback(() => {
    const metrics = metricsRef.current;
    if (metrics.length === 0) return null;

    const renderTimes = metrics.map(m => m.renderTime);
    const avgRenderTime =
      renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
    const maxRenderTime = Math.max(...renderTimes);
    const minRenderTime = Math.min(...renderTimes);
    const slowRenders = renderTimes.filter(time => time > threshold).length;

    return {
      totalRenders: metrics.length,
      averageRenderTime: avgRenderTime,
      maxRenderTime,
      minRenderTime,
      slowRenders,
      slowRenderPercentage: (slowRenders / metrics.length) * 100,
    };
  }, [threshold]);

  // Clear metrics
  const clearMetrics = useCallback(() => {
    metricsRef.current = [];
    renderCount.current = 0;
  }, []);

  // Debounce utility for expensive operations
  const debounce = useCallback(
    <T extends (...args: any[]) => any>(func: T, delay: number): T => {
      let timeoutId: ReturnType<typeof setTimeout>;

      return ((...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
      }) as T;
    },
    []
  );

  // Throttle utility for frequent operations
  const throttle = useCallback(
    <T extends (...args: any[]) => any>(func: T, delay: number): T => {
      let lastCall = 0;

      return ((...args: Parameters<T>) => {
        const now = Date.now();
        if (now - lastCall >= delay) {
          lastCall = now;
          func(...args);
        }
      }) as T;
    },
    []
  );

  return {
    getPerformanceStats,
    clearMetrics,
    debounce,
    throttle,
    renderCount: renderCount.current,
  };
};

// Hook for measuring specific operations
export const useOperationTimer = (operationName: string) => {
  const startTime = useRef<number>(0);

  const startTimer = useCallback(() => {
    startTime.current = performance.now();
  }, []);

  const endTimer = useCallback(() => {
    const duration = performance.now() - startTime.current;
    logger.info(`${operationName} completed`, {
      duration: `${duration.toFixed(2)}ms`,
    });
    return duration;
  }, [operationName]);

  return { startTimer, endTimer };
};

// Hook for memory monitoring
export const useMemoryMonitor = (componentName: string, interval = 5000) => {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if ('memory' in performance) {
      intervalRef.current = setInterval(() => {
        const memory = (performance as any).memory;
        const usedMB = memory.usedJSHeapSize / 1024 / 1024;
        const totalMB = memory.totalJSHeapSize / 1024 / 1024;
        const limitMB = memory.jsHeapSizeLimit / 1024 / 1024;
        const usagePercentage = (usedMB / limitMB) * 100;

        logger.info(`${componentName} memory usage`, {
          used: `${usedMB.toFixed(2)}MB`,
          total: `${totalMB.toFixed(2)}MB`,
          limit: `${limitMB.toFixed(2)}MB`,
          usagePercentage: `${usagePercentage.toFixed(1)}%`,
        });

        // Warn if memory usage is high
        if (usagePercentage > 80) {
          logger.warn(`${componentName} high memory usage detected`, {
            usagePercentage: `${usagePercentage.toFixed(1)}%`,
          });
        }
      }, interval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [componentName, interval]);
};
