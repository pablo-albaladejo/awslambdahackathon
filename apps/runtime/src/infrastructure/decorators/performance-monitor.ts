import { logger } from '@awslambdahackathon/utils/lambda';
import { MetricsService } from '@domain/services/metrics-service';
import {
  PerformanceContext,
  PerformanceMonitoringService,
} from '@domain/services/performance-monitoring-service';

export interface PerformanceMonitorOptions {
  operation: string;
  service: string;
  metadata?: Record<string, unknown>;
  recordMetrics?: boolean;
  logPerformance?: boolean;
}

export interface PerformanceMonitorInstance {
  complete(
    success: boolean,
    additionalMetadata?: Record<string, unknown>
  ): void;
  addMetadata(key: string, value: unknown): void;
  recordError(error: Error): void;
}

export class PerformanceMonitorDecorator {
  constructor(
    private readonly performanceMonitoringService: PerformanceMonitoringService,
    private readonly metricsService: MetricsService
  ) {}

  /**
   * Start monitoring a specific operation
   */
  startMonitoring(
    options: PerformanceMonitorOptions
  ): PerformanceMonitorInstance {
    const startTime = Date.now();
    const metadata = { ...options.metadata };

    const context: PerformanceContext = {
      operation: options.operation,
      service: options.service,
      ...metadata,
    };

    const performanceMonitor =
      this.performanceMonitoringService.startMonitoring(
        options.operation,
        context
      );

    if (options.logPerformance) {
      logger.debug('Performance monitoring started', {
        operation: options.operation,
        service: options.service,
        metadata,
      });
    }

    return {
      complete: (
        success: boolean,
        additionalMetadata?: Record<string, unknown>
      ) => {
        const duration = Date.now() - startTime;
        const finalMetadata = { ...metadata, ...additionalMetadata };

        performanceMonitor.complete(success);

        if (options.recordMetrics) {
          this.metricsService.recordBusinessMetrics(
            `${options.operation}_duration`,
            duration,
            {
              service: options.service,
              success: success.toString(),
              ...finalMetadata,
            }
          );
        }

        if (options.logPerformance) {
          const logLevel = success ? 'debug' : 'warn';
          logger[logLevel]('Performance monitoring completed', {
            operation: options.operation,
            service: options.service,
            success,
            duration,
            metadata: finalMetadata,
          });
        }
      },

      addMetadata: (key: string, value: unknown) => {
        metadata[key] = value;
      },

      recordError: (error: Error) => {
        metadata.error = error.message;
        metadata.errorType = error.constructor.name;
        if (options.recordMetrics) {
          this.metricsService.recordErrorMetrics(
            error.constructor.name,
            options.operation,
            {
              service: options.service,
              errorMessage: error.message,
            }
          );
        }
      },
    };
  }
}

/**
 * Higher-order function for performance monitoring
 */
export function withPerformanceMonitoring<Args extends unknown[], Result>(
  fn: (...args: Args) => Promise<Result>,
  options: PerformanceMonitorOptions,
  performanceMonitoringService: PerformanceMonitoringService,
  metricsService: MetricsService
): (...args: Args) => Promise<Result> {
  return async (...args: Args): Promise<Result> => {
    const monitor = new PerformanceMonitorDecorator(
      performanceMonitoringService,
      metricsService
    );
    const instance = monitor.startMonitoring(options);

    try {
      const result = await fn(...args);
      instance.complete(true);
      return result;
    } catch (error) {
      instance.recordError(error as Error);
      instance.complete(false);
      throw error;
    }
  };
}
