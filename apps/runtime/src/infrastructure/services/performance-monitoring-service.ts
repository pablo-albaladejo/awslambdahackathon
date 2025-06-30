import { logger } from '@awslambdahackathon/utils/lambda';
import { CloudWatchConfig } from '@config/container';
import {
  PerformanceContext,
  PerformanceData,
  PerformanceMetrics,
  PerformanceMonitoringService,
  PerformanceStats,
  PerformanceThresholds,
} from '@domain/services/performance-monitoring-service';
import { Metric, PerformanceMetric } from '@domain/value-objects/metric';
import {
  AwsCloudWatchPerformanceAdapter,
  CloudWatchPerformanceAdapter,
} from '@infrastructure/adapters/outbound/cloudwatch';

export class CloudWatchPerformanceMonitoringService
  implements PerformanceMonitoringService
{
  private activeOperations: Map<string, PerformanceData> = new Map();
  private metricsBuffer: Metric[] = [];
  private lastFlush: Date | null = null;
  private readonly maxBufferSize = 100;
  private readonly adapter: CloudWatchPerformanceAdapter;
  private readonly namespace: string;
  private currentSpan: {
    name: string;
    startTime: number;
    tags?: Record<string, string>;
  } | null = null;

  constructor(config: CloudWatchConfig) {
    this.adapter = new AwsCloudWatchPerformanceAdapter(config.namespace);
    this.namespace = config.namespace;
  }

  async startSpan(name: string, tags?: Record<string, string>): Promise<void> {
    if (this.currentSpan) {
      logger.warn('Starting a new span while another is active', {
        currentSpan: this.currentSpan.name,
        newSpan: name,
      });
      await this.endSpan();
    }

    this.currentSpan = {
      name,
      startTime: Date.now(),
      tags,
    };

    logger.debug('Started performance span', {
      name,
      tags,
    });
  }

  async endSpan(error?: Error): Promise<void> {
    if (!this.currentSpan) {
      logger.warn('Attempting to end a non-existent span');
      return;
    }

    const duration = Date.now() - this.currentSpan.startTime;
    const success = !error;

    const metric: Metric = {
      name: this.currentSpan.name,
      type: 'span',
      tags: {
        ...this.currentSpan.tags,
        success: success.toString(),
        ...(error && {
          error: error.message,
          errorType: error.constructor.name,
        }),
      },
      duration,
      success,
      error: error?.message,
      timestamp: Date.now(),
    };

    await this.recordMetric(metric);

    logger.debug('Ended performance span', {
      name: this.currentSpan.name,
      duration,
      success,
      error: error?.message,
    });

    this.currentSpan = null;
  }

  startMonitoring(
    operation: string,
    context: PerformanceContext
  ): {
    complete(
      success: boolean,
      requestSize?: number,
      responseSize?: number
    ): void;
  } {
    const operationId = `${operation}_${Date.now()}_${Math.random()}`;
    const startTime = new Date();

    const performanceData: PerformanceData = {
      operation,
      startTime,
      context,
      metrics: {
        duration: 0,
        memoryUsage: 0,
        success: false,
        errorCount: 0,
      },
    };

    this.activeOperations.set(operationId, performanceData);

    logger.debug('Started performance monitoring', {
      operationId,
      operation,
      context,
    });

    return {
      complete: (
        success: boolean,
        requestSize?: number,
        responseSize?: number
      ) => {
        this.completeOperation(operationId, success, requestSize, responseSize);
      },
    };
  }

  async recordMetrics(metric: Metric, namespace?: string): Promise<void> {
    this.metricsBuffer.push(metric);

    if (this.metricsBuffer.length >= this.maxBufferSize) {
      await this.flushMetrics(namespace);
    }

    logger.debug('Performance metrics recorded', {
      metric,
      bufferSize: this.metricsBuffer.length,
    });
  }

  recordBusinessMetric(
    metricName: string,
    value: number,
    unit: string,
    context: PerformanceContext,
    additionalDimensions?: Array<{ Name: string; Value: string }>
  ): void {
    const contextTags: Record<string, string> = {};
    Object.entries(context).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        contextTags[key] = String(value);
      }
    });

    const metric: Metric = {
      name: metricName,
      type: 'business',
      value,
      unit,
      tags: {
        ...contextTags,
        ...additionalDimensions?.reduce(
          (acc, dim) => {
            acc[dim.Name] = dim.Value;
            return acc;
          },
          {} as Record<string, string>
        ),
      },
      timestamp: Date.now(),
    };

    this.recordMetrics(metric);
  }

  recordErrorMetric(
    errorType: string,
    errorCode: string,
    context: PerformanceContext
  ): void {
    const contextTags: Record<string, string> = {};
    Object.entries(context).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        contextTags[key] = String(value);
      }
    });

    const metric: Metric = {
      name: 'ErrorCount',
      type: 'error',
      value: 1,
      unit: 'Count',
      tags: {
        ...contextTags,
        errorType,
        errorCode,
      },
      timestamp: Date.now(),
    };

    this.recordMetrics(metric);
  }

  private convertToMetric(
    metrics: PerformanceMetrics,
    context: PerformanceContext
  ): Metric {
    const contextTags: Record<string, string> = {};
    Object.entries(context).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        contextTags[key] = String(value);
      }
    });

    return {
      name: 'PerformanceMetrics',
      type: 'operation',
      tags: {
        ...contextTags,
        success: metrics.success.toString(),
        errorCount: metrics.errorCount.toString(),
        ...(metrics.requestSize && {
          requestSize: metrics.requestSize.toString(),
        }),
        ...(metrics.responseSize && {
          responseSize: metrics.responseSize.toString(),
        }),
        ...(metrics.externalCalls && {
          externalCalls: metrics.externalCalls.toString(),
        }),
        ...(metrics.databaseCalls && {
          databaseCalls: metrics.databaseCalls.toString(),
        }),
      },
      duration: metrics.duration,
      success: metrics.success,
      timestamp: Date.now(),
      value: metrics.memoryUsage,
      unit: 'Bytes',
    };
  }

  checkPerformanceThresholds(
    metrics: PerformanceMetrics,
    context: PerformanceContext,
    thresholds: PerformanceThresholds
  ): void {
    const contextTags: Record<string, string> = {};
    Object.entries(context).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        contextTags[key] = String(value);
      }
    });

    const metricsToRecord: Metric[] = [
      {
        name: 'OperationDuration',
        type: 'duration',
        value: metrics.duration,
        unit: 'Milliseconds',
        tags: contextTags,
        timestamp: Date.now(),
      },
      {
        name: 'MemoryUsage',
        type: 'memory',
        value: metrics.memoryUsage,
        unit: 'Bytes',
        tags: contextTags,
        timestamp: Date.now(),
      },
      {
        name: 'OperationSuccess',
        type: 'success',
        value: metrics.success ? 1 : 0,
        unit: 'Count',
        tags: contextTags,
        timestamp: Date.now(),
      },
      {
        name: 'OperationErrors',
        type: 'error',
        value: metrics.errorCount,
        unit: 'Count',
        tags: contextTags,
        timestamp: Date.now(),
      },
      {
        name: 'PerformanceThreshold',
        type: 'threshold',
        value: metrics.duration,
        unit: 'Milliseconds',
        tags: {
          ...contextTags,
          warning: thresholds.warning.toString(),
          critical: thresholds.critical.toString(),
          timeout: thresholds.timeout.toString(),
          exceeded: (
            metrics.duration > thresholds.warning ||
            metrics.duration > thresholds.critical ||
            metrics.duration > thresholds.timeout
          ).toString(),
        },
        timestamp: Date.now(),
      },
    ];

    if (metrics.externalCalls !== undefined) {
      metricsToRecord.push({
        name: 'ExternalCalls',
        type: 'operation',
        value: metrics.externalCalls,
        unit: 'Count',
        tags: contextTags,
        timestamp: Date.now(),
      });
    }

    if (metrics.databaseCalls !== undefined) {
      metricsToRecord.push({
        name: 'DatabaseCalls',
        type: 'operation',
        value: metrics.databaseCalls,
        unit: 'Count',
        tags: contextTags,
        timestamp: Date.now(),
      });
    }

    if (metrics.requestSize !== undefined) {
      metricsToRecord.push({
        name: 'RequestSize',
        type: 'operation',
        value: metrics.requestSize,
        unit: 'Bytes',
        tags: contextTags,
        timestamp: Date.now(),
      });
    }

    if (metrics.responseSize !== undefined) {
      metricsToRecord.push({
        name: 'ResponseSize',
        type: 'operation',
        value: metrics.responseSize,
        unit: 'Bytes',
        tags: contextTags,
        timestamp: Date.now(),
      });
    }

    metricsToRecord.forEach(metric => this.recordMetrics(metric));

    if (metrics.duration > thresholds.critical) {
      logger.error('Critical performance threshold exceeded', {
        duration: metrics.duration,
        threshold: thresholds.critical,
        context,
      });
    } else if (metrics.duration > thresholds.warning) {
      logger.warn('Performance warning threshold exceeded', {
        duration: metrics.duration,
        threshold: thresholds.warning,
        context,
      });
    }

    if (metrics.duration > thresholds.timeout) {
      logger.error('Performance timeout threshold exceeded', {
        duration: metrics.duration,
        threshold: thresholds.timeout,
        context,
      });
    }
  }

  getPerformanceStats(): PerformanceStats {
    return {
      totalMetrics: this.metricsBuffer.length,
      bufferSize: this.maxBufferSize,
      lastFlush: this.lastFlush,
    };
  }

  async flushMetrics(namespace?: string): Promise<void> {
    if (this.metricsBuffer.length === 0) {
      logger.debug('No metrics to flush');
      return;
    }

    try {
      // Batch metrics to avoid CloudWatch limits
      const batchSize = 20;
      for (let i = 0; i < this.metricsBuffer.length; i += batchSize) {
        const batch = this.metricsBuffer.slice(i, i + batchSize);

        await this.adapter.publishPerformanceMetrics(batch, namespace);
      }

      logger.info('Performance metrics flushed successfully', {
        count: this.metricsBuffer.length,
        namespace: namespace || this.namespace,
      });

      this.metricsBuffer = [];
      this.lastFlush = new Date();
    } catch (error) {
      logger.error('Failed to flush performance metrics', {
        error: error instanceof Error ? error.message : String(error),
        metricsCount: this.metricsBuffer.length,
      });
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down performance monitoring service');
    await this.flushMetrics();
    this.activeOperations.clear();
    this.metricsBuffer = [];
  }

  private getStandardUnit(unit: string): string {
    const unitMap: Record<string, string> = {
      ms: 'Milliseconds',
      milliseconds: 'Milliseconds',
      seconds: 'Seconds',
      bytes: 'Bytes',
      count: 'Count',
      percent: 'Percent',
      none: 'None',
    };

    return unitMap[unit.toLowerCase()] || 'None';
  }

  private completeOperation(
    operationId: string,
    success: boolean,
    requestSize?: number,
    responseSize?: number
  ): void {
    const data = this.activeOperations.get(operationId);
    if (!data) {
      logger.warn('Attempted to complete non-existent operation', {
        operationId,
      });
      return;
    }

    const endTime = new Date();
    const duration = endTime.getTime() - data.startTime.getTime();
    const memoryUsage = process.memoryUsage().heapUsed;

    const contextTags: Record<string, string> = {};
    Object.entries(data.context).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        contextTags[key] = String(value);
      }
    });

    const metric: PerformanceMetric = {
      name: data.operation,
      type: 'operation',
      tags: {
        ...contextTags,
        success: success.toString(),
        ...(requestSize && { requestSize: requestSize.toString() }),
        ...(responseSize && { responseSize: responseSize.toString() }),
      },
      duration,
      memoryUsage,
      success,
      errorCount: success ? 0 : 1,
      timestamp: Date.now(),
      value: memoryUsage,
      unit: 'Bytes',
    };

    this.recordMetrics(metric);

    const metrics: PerformanceMetrics = {
      duration,
      memoryUsage,
      success,
      errorCount: success ? 0 : 1,
      requestSize,
      responseSize,
    };

    this.checkPerformanceThresholds(metrics, data.context, {
      warning: 1000,
      critical: 5000,
      timeout: 10000,
    });

    this.activeOperations.delete(operationId);

    logger.debug('Performance monitoring completed', {
      operationId,
      operation: data.operation,
      duration,
      success,
      memoryUsage,
    });
  }

  private async recordMetric(metric: Metric): Promise<void> {
    await this.recordMetrics(metric);
  }
}

/**
 * Performance monitor for tracking individual operations
 */
export class PerformanceMonitor {
  private startTime: bigint;
  private startMemory: ReturnType<typeof process.memoryUsage>;
  private externalCalls = 0;
  private databaseCalls = 0;
  private errors: Error[] = [];
  private operation: string;
  private context: PerformanceContext;
  private monitoringService: PerformanceMonitoringService;

  constructor(
    operation: string,
    context: PerformanceContext,
    startTime: bigint,
    startMemory: ReturnType<typeof process.memoryUsage>,
    monitoringService: PerformanceMonitoringService
  ) {
    this.operation = operation;
    this.context = context;
    this.startTime = startTime;
    this.startMemory = startMemory;
    this.monitoringService = monitoringService;
  }

  /**
   * Record an external service call
   */
  recordExternalCall(): void {
    this.externalCalls++;
  }

  /**
   * Record a database call
   */
  recordDatabaseCall(): void {
    this.databaseCalls++;
  }

  /**
   * Record an error
   */
  recordError(error: Error): void {
    this.errors.push(error);
  }

  /**
   * Complete monitoring and record metrics
   */
  complete(
    success: boolean,
    requestSize?: number,
    responseSize?: number
  ): void {
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();

    const duration = Number(endTime - this.startTime) / 1000000; // Convert to milliseconds
    const memoryUsage = endMemory.heapUsed - this.startMemory.heapUsed;

    const contextTags: Record<string, string> = {};
    Object.entries(this.context).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        contextTags[key] = String(value);
      }
    });

    const metric: Metric = {
      name: this.operation,
      type: 'operation',
      tags: {
        ...contextTags,
        success: success.toString(),
        errorCount: this.errors.length.toString(),
        ...(this.externalCalls && {
          externalCalls: this.externalCalls.toString(),
        }),
        ...(this.databaseCalls && {
          databaseCalls: this.databaseCalls.toString(),
        }),
        ...(requestSize && { requestSize: requestSize.toString() }),
        ...(responseSize && { responseSize: responseSize.toString() }),
      },
      duration,
      success,
      value: memoryUsage,
      unit: 'Bytes',
      timestamp: Date.now(),
    };

    this.monitoringService.recordMetrics(metric);

    // Record error metrics if any errors occurred
    if (this.errors.length > 0) {
      this.errors.forEach(error => {
        this.monitoringService.recordErrorMetric(
          error.name,
          error.message,
          this.context
        );
      });
    }
  }
}
