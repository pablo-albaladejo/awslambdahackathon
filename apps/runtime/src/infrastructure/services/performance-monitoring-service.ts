import {
  CloudWatchClient,
  PutMetricDataCommand,
  type StandardUnit,
} from '@aws-sdk/client-cloudwatch';
import { logger } from '@awslambdahackathon/utils/lambda';

export interface PerformanceMetrics {
  duration: number;
  memoryUsage: number;
  cpuUsage?: number;
  success: boolean;
  errorCount: number;
  requestSize?: number;
  responseSize?: number;
  externalCalls?: number;
  databaseCalls?: number;
}

export interface PerformanceContext {
  operation: string;
  service: string;
  connectionId?: string;
  userId?: string;
  correlationId?: string;
  stage?: string;
  environment?: string;
}

export interface PerformanceThresholds {
  warning: number;
  critical: number;
  timeout: number;
}

export class PerformanceMonitoringService {
  private cloudWatchClient: CloudWatchClient;
  private metricsBuffer: Array<{
    namespace: string;
    metricData: Array<{
      MetricName: string;
      Value: number;
      Unit: StandardUnit;
      Dimensions: Array<{ Name: string; Value: string }>;
      Timestamp: Date;
    }>;
  }> = [];
  private readonly bufferSize = 20;
  private readonly flushInterval = 60000; // 1 minute
  private flushTimer?: ReturnType<typeof setInterval>;

  constructor() {
    this.cloudWatchClient = new CloudWatchClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.startPeriodicFlush();
  }

  /**
   * Start performance monitoring for an operation
   */
  startMonitoring(
    operation: string,
    context: PerformanceContext
  ): PerformanceMonitor {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();

    return new PerformanceMonitor(
      operation,
      context,
      startTime,
      startMemory,
      this
    );
  }

  /**
   * Record performance metrics
   */
  recordMetrics(
    metrics: PerformanceMetrics,
    context: PerformanceContext
  ): void {
    const timestamp = new Date();
    const namespace = `WebSocketService/${context.environment || 'dev'}`;
    const baseDimensions = [
      { Name: 'Service', Value: context.service },
      { Name: 'Operation', Value: context.operation },
      { Name: 'Stage', Value: context.stage || 'dev' },
    ];

    // Add optional dimensions
    if (context.connectionId) {
      baseDimensions.push({
        Name: 'ConnectionId',
        Value: context.connectionId,
      });
    }
    if (context.userId) {
      baseDimensions.push({ Name: 'UserId', Value: context.userId });
    }

    const metricData = [
      {
        MetricName: 'Duration',
        Value: metrics.duration,
        Unit: 'Milliseconds' as StandardUnit,
        Dimensions: baseDimensions,
        Timestamp: timestamp,
      },
      {
        MetricName: 'MemoryUsage',
        Value: metrics.memoryUsage,
        Unit: 'Bytes' as StandardUnit,
        Dimensions: baseDimensions,
        Timestamp: timestamp,
      },
      {
        MetricName: 'Success',
        Value: metrics.success ? 1 : 0,
        Unit: 'Count' as StandardUnit,
        Dimensions: baseDimensions,
        Timestamp: timestamp,
      },
      {
        MetricName: 'ErrorCount',
        Value: metrics.errorCount,
        Unit: 'Count' as StandardUnit,
        Dimensions: baseDimensions,
        Timestamp: timestamp,
      },
    ];

    // Add optional metrics
    if (metrics.cpuUsage !== undefined) {
      metricData.push({
        MetricName: 'CpuUsage',
        Value: metrics.cpuUsage,
        Unit: 'Percent' as StandardUnit,
        Dimensions: baseDimensions,
        Timestamp: timestamp,
      });
    }

    if (metrics.requestSize !== undefined) {
      metricData.push({
        MetricName: 'RequestSize',
        Value: metrics.requestSize,
        Unit: 'Bytes' as StandardUnit,
        Dimensions: baseDimensions,
        Timestamp: timestamp,
      });
    }

    if (metrics.responseSize !== undefined) {
      metricData.push({
        MetricName: 'ResponseSize',
        Value: metrics.responseSize,
        Unit: 'Bytes' as StandardUnit,
        Dimensions: baseDimensions,
        Timestamp: timestamp,
      });
    }

    if (metrics.externalCalls !== undefined) {
      metricData.push({
        MetricName: 'ExternalCalls',
        Value: metrics.externalCalls,
        Unit: 'Count' as StandardUnit,
        Dimensions: baseDimensions,
        Timestamp: timestamp,
      });
    }

    if (metrics.databaseCalls !== undefined) {
      metricData.push({
        MetricName: 'DatabaseCalls',
        Value: metrics.databaseCalls,
        Unit: 'Count' as StandardUnit,
        Dimensions: baseDimensions,
        Timestamp: timestamp,
      });
    }

    // Add to buffer
    this.addToBuffer(namespace, metricData);

    // Log performance data
    this.logPerformanceData(metrics, context);
  }

  /**
   * Record custom business metrics
   */
  recordBusinessMetric(
    metricName: string,
    value: number,
    unit: StandardUnit,
    context: PerformanceContext,
    additionalDimensions: Array<{ Name: string; Value: string }> = []
  ): void {
    const timestamp = new Date();
    const namespace = `WebSocketService/${context.environment || 'dev'}`;
    const dimensions = [
      { Name: 'Service', Value: context.service },
      { Name: 'Operation', Value: context.operation },
      { Name: 'Stage', Value: context.stage || 'dev' },
      ...additionalDimensions,
    ];

    const metricData = [
      {
        MetricName: metricName,
        Value: value,
        Unit: unit,
        Dimensions: dimensions,
        Timestamp: timestamp,
      },
    ];

    this.addToBuffer(namespace, metricData);
  }

  /**
   * Record error metrics
   */
  recordErrorMetric(
    errorType: string,
    errorCode: string,
    context: PerformanceContext
  ): void {
    const timestamp = new Date();
    const namespace = `WebSocketService/${context.environment || 'dev'}`;
    const dimensions = [
      { Name: 'Service', Value: context.service },
      { Name: 'Operation', Value: context.operation },
      { Name: 'ErrorType', Value: errorType },
      { Name: 'ErrorCode', Value: errorCode },
      { Name: 'Stage', Value: context.stage || 'dev' },
    ];

    const metricData = [
      {
        MetricName: 'Errors',
        Value: 1,
        Unit: 'Count' as StandardUnit,
        Dimensions: dimensions,
        Timestamp: timestamp,
      },
    ];

    this.addToBuffer(namespace, metricData);
  }

  /**
   * Check performance thresholds and alert if exceeded
   */
  checkPerformanceThresholds(
    metrics: PerformanceMetrics,
    context: PerformanceContext,
    thresholds: PerformanceThresholds
  ): void {
    const { duration, success } = metrics;

    if (!success) {
      logger.warn('Performance threshold exceeded - Operation failed', {
        operation: context.operation,
        service: context.service,
        duration,
        correlationId: context.correlationId,
      });
      return;
    }

    if (duration >= thresholds.critical) {
      logger.error('Critical performance threshold exceeded', {
        operation: context.operation,
        service: context.service,
        duration,
        threshold: thresholds.critical,
        correlationId: context.correlationId,
      });
    } else if (duration >= thresholds.warning) {
      logger.warn('Performance warning threshold exceeded', {
        operation: context.operation,
        service: context.service,
        duration,
        threshold: thresholds.warning,
        correlationId: context.correlationId,
      });
    }
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    totalMetrics: number;
    bufferSize: number;
    lastFlush: Date | null;
  } {
    return {
      totalMetrics: this.metricsBuffer.reduce(
        (sum, item) => sum + item.metricData.length,
        0
      ),
      bufferSize: this.metricsBuffer.length,
      lastFlush: this.lastFlushTime,
    };
  }

  /**
   * Force flush metrics to CloudWatch
   */
  async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) {
      return;
    }

    try {
      const promises = this.metricsBuffer.map(async bufferItem => {
        const command = new PutMetricDataCommand({
          Namespace: bufferItem.namespace,
          MetricData: bufferItem.metricData,
        });

        await this.cloudWatchClient.send(command);
      });

      await Promise.all(promises);

      logger.info('Performance metrics flushed to CloudWatch', {
        metricCount: this.metricsBuffer.reduce(
          (sum, item) => sum + item.metricData.length,
          0
        ),
        bufferCount: this.metricsBuffer.length,
      });

      this.metricsBuffer = [];
      this.lastFlushTime = new Date();
    } catch (error) {
      logger.error('Failed to flush performance metrics to CloudWatch', {
        error: error instanceof Error ? error.message : String(error),
        metricCount: this.metricsBuffer.reduce(
          (sum, item) => sum + item.metricData.length,
          0
        ),
      });
    }
  }

  /**
   * Add metrics to buffer
   */
  private addToBuffer(
    namespace: string,
    metricData: Array<{
      MetricName: string;
      Value: number;
      Unit: StandardUnit;
      Dimensions: Array<{ Name: string; Value: string }>;
      Timestamp: Date;
    }>
  ): void {
    const existingBuffer = this.metricsBuffer.find(
      item => item.namespace === namespace
    );

    if (existingBuffer) {
      existingBuffer.metricData.push(...metricData);
    } else {
      this.metricsBuffer.push({ namespace, metricData });
    }

    // Flush if buffer is full
    if (
      this.metricsBuffer.reduce(
        (sum, item) => sum + item.metricData.length,
        0
      ) >= this.bufferSize
    ) {
      this.flushMetrics();
    }
  }

  /**
   * Log performance data for debugging
   */
  private logPerformanceData(
    metrics: PerformanceMetrics,
    context: PerformanceContext
  ): void {
    const logLevel = metrics.success ? 'info' : 'warn';

    logger[logLevel]('Performance metrics recorded', {
      operation: context.operation,
      service: context.service,
      duration: metrics.duration,
      memoryUsage: metrics.memoryUsage,
      success: metrics.success,
      errorCount: metrics.errorCount,
      correlationId: context.correlationId,
      connectionId: context.connectionId,
      userId: context.userId,
    });
  }

  /**
   * Start periodic flush timer
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flushMetrics();
    }, this.flushInterval);
  }

  /**
   * Stop the service and flush remaining metrics
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flushMetrics();
  }

  private lastFlushTime: Date | null = null;
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

    const metrics: PerformanceMetrics = {
      duration,
      memoryUsage,
      success,
      errorCount: this.errors.length,
      externalCalls: this.externalCalls,
      databaseCalls: this.databaseCalls,
      requestSize,
      responseSize,
    };

    this.monitoringService.recordMetrics(metrics, this.context);

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
