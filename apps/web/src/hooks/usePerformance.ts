import { logger } from '@awslambdahackathon/utils/frontend';
import { useCallback, useEffect, useRef, useState } from 'react';

// Type definitions
interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

interface PerformanceStats {
  averageRenderTime: number;
  slowRenderPercentage: number;
  totalRenders: number;
  slowRenderThreshold: number;
}

interface PerformanceObserverEntry {
  name: string;
  startTime: number;
  duration: number;
  entryType: string;
}

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory: MemoryInfo;
}

// Performance tracking state
const performanceMetrics: PerformanceMetric[] = [];
const renderTimes: number[] = [];

// Performance monitoring hook
export const usePerformance = (componentName: string) => {
  const [stats, setStats] = useState<PerformanceStats>({
    averageRenderTime: 0,
    slowRenderPercentage: 0,
    totalRenders: 0,
    slowRenderThreshold: 16, // 60fps threshold
  });

  const renderStartTime = useRef<number>(0);
  const observerRef = useRef<PerformanceObserver | null>(null);

  // Record a performance metric
  const recordMetric = useCallback(
    (name: string, value: number, metadata?: Record<string, unknown>) => {
      const metric: PerformanceMetric = {
        name,
        value,
        timestamp: Date.now(),
        metadata,
      };

      performanceMetrics.push(metric);

      // Keep only last 1000 metrics
      if (performanceMetrics.length > 1000) {
        performanceMetrics.shift();
      }

      logger.debug('Performance metric recorded:', metric);
    },
    []
  );

  // Record render time
  const recordRenderTime = useCallback(
    (renderTime: number) => {
      renderTimes.push(renderTime);

      // Keep only last 100 render times
      if (renderTimes.length > 100) {
        renderTimes.shift();
      }

      // Update stats
      const averageRenderTime =
        renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
      const slowRenders = renderTimes.filter(
        time => time > stats.slowRenderThreshold
      ).length;
      const slowRenderPercentage = (slowRenders / renderTimes.length) * 100;

      setStats({
        averageRenderTime,
        slowRenderPercentage,
        totalRenders: renderTimes.length,
        slowRenderThreshold: stats.slowRenderThreshold,
      });

      // Log slow renders
      if (renderTime > stats.slowRenderThreshold) {
        logger.warn('Slow render detected:', {
          component: componentName,
          renderTime,
          threshold: stats.slowRenderThreshold,
        });
      }

      recordMetric('component_render_time', renderTime, {
        component: componentName,
        threshold: stats.slowRenderThreshold,
      });
    },
    [componentName, recordMetric, stats.slowRenderThreshold]
  );

  // Start render timing
  const startRenderTimer = useCallback(() => {
    renderStartTime.current = performance.now();
  }, []);

  // End render timing
  const endRenderTimer = useCallback(() => {
    const renderTime = performance.now() - renderStartTime.current;
    recordRenderTime(renderTime);
  }, [recordRenderTime]);

  // Get performance statistics
  const getPerformanceStats = useCallback((): PerformanceStats => {
    return stats;
  }, [stats]);

  // Monitor memory usage
  const monitorMemory = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as PerformanceWithMemory).memory;
      const memoryUsage = {
        used: memory.usedJSHeapSize / 1024 / 1024, // MB
        total: memory.totalJSHeapSize / 1024 / 1024, // MB
        limit: memory.jsHeapSizeLimit / 1024 / 1024, // MB
      };

      recordMetric('memory_usage', memoryUsage.used, {
        total: memoryUsage.total,
        limit: memoryUsage.limit,
        component: componentName,
      });

      // Warn if memory usage is high
      if (memoryUsage.used > memoryUsage.limit * 0.8) {
        logger.warn('High memory usage detected:', {
          component: componentName,
          used: memoryUsage.used,
          limit: memoryUsage.limit,
        });
      }
    }
  }, [componentName, recordMetric]);

  // Monitor long tasks
  const monitorLongTasks = useCallback(() => {
    if ('PerformanceObserver' in window) {
      try {
        observerRef.current = new PerformanceObserver(list => {
          const entries = list.getEntries();

          entries.forEach(entry => {
            const longTaskEntry = entry as PerformanceObserverEntry;
            if (longTaskEntry.duration > 50) {
              // 50ms threshold
              logger.warn('Long task detected:', {
                component: componentName,
                duration: longTaskEntry.duration,
                name: longTaskEntry.name,
              });

              recordMetric('long_task', longTaskEntry.duration, {
                name: longTaskEntry.name,
                component: componentName,
              });
            }
          });
        });

        observerRef.current.observe({ entryTypes: ['longtask'] });
      } catch (error) {
        logger.warn('Long task observer not supported');
      }
    }
  }, [componentName, recordMetric]);

  // Monitor layout shifts
  const monitorLayoutShifts = useCallback(() => {
    if ('PerformanceObserver' in window) {
      try {
        const layoutShiftObserver = new PerformanceObserver(list => {
          let clsValue = 0;

          for (const entry of list.getEntries()) {
            const layoutShiftEntry =
              entry as unknown as PerformanceObserverEntry & {
                value: number;
                hadRecentInput: boolean;
              };
            if (!layoutShiftEntry.hadRecentInput) {
              clsValue += layoutShiftEntry.value;
            }
          }

          if (clsValue > 0.1) {
            // 0.1 threshold
            logger.warn('Layout shift detected:', {
              component: componentName,
              value: clsValue,
            });

            recordMetric('layout_shift', clsValue, {
              component: componentName,
            });
          }
        });

        layoutShiftObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (error) {
        logger.warn('Layout shift observer not supported');
      }
    }
  }, [componentName, recordMetric]);

  // Initialize performance monitoring
  useEffect(() => {
    // Monitor memory usage every 30 seconds
    const memoryInterval = setInterval(monitorMemory, 30000);

    // Monitor long tasks
    monitorLongTasks();

    // Monitor layout shifts
    monitorLayoutShifts();

    return () => {
      clearInterval(memoryInterval);

      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [monitorMemory, monitorLongTasks, monitorLayoutShifts]);

  return {
    startRenderTimer,
    endRenderTimer,
    recordMetric,
    getPerformanceStats,
    stats,
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
        const memory = (performance as PerformanceWithMemory).memory;
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
