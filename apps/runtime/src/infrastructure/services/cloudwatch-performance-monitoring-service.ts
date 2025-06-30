import {
  CloudWatchClient,
  PutMetricDataCommand,
  StandardUnit,
} from '@aws-sdk/client-cloudwatch';
import { logger } from '@awslambdahackathon/utils/lambda';
import {
  PerformanceContext,
  PerformanceData,
  PerformanceMetrics,
  PerformanceMonitoringService,
  PerformanceStats,
  PerformanceThresholds,
} from '@domain/services/performance-monitoring-service';

export class CloudWatchPerformanceMonitoringService
  implements PerformanceMonitoringService
{
  private activeOperations: Map<string, PerformanceData> = new Map();
  private metricsBuffer: PerformanceMetrics[] = [];
  private lastFlush: Date | null = null;
  private readonly maxBufferSize = 100;
  private readonly cloudWatchClient: CloudWatchClient;
  private readonly namespace: string;

  constructor(namespace = 'AWSLambdaHackathon/Performance') {
    this.cloudWatchClient = new CloudWatchClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.namespace = namespace;
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

  recordMetrics(
    metrics: PerformanceMetrics,
    context: PerformanceContext
  ): void {
    this.metricsBuffer.push({
      ...metrics,
      ...context,
    });

    if (this.metricsBuffer.length >= this.maxBufferSize) {
      this.flushMetrics();
    }

    logger.debug('Performance metrics recorded', {
      metrics,
      context,
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
    const metric = {
      name: metricName,
      value,
      unit,
      context,
      dimensions: additionalDimensions?.reduce(
        (acc, dim) => {
          acc[dim.Name] = dim.Value;
          return acc;
        },
        {} as Record<string, string>
      ),
    };

    logger.info('Business metric recorded', metric);

    // Send business metric to CloudWatch immediately
    this.sendMetricToCloudWatch(
      metricName,
      value,
      unit,
      context,
      additionalDimensions
    );
  }

  recordErrorMetric(
    errorType: string,
    errorCode: string,
    context: PerformanceContext
  ): void {
    const errorMetric = {
      errorType,
      errorCode,
      context,
      timestamp: new Date(),
    };

    logger.error('Error metric recorded', errorMetric);

    // Send error metric to CloudWatch immediately
    this.sendMetricToCloudWatch('ErrorCount', 1, 'Count', context, [
      { Name: 'ErrorType', Value: errorType },
      { Name: 'ErrorCode', Value: errorCode },
    ]);
  }

  checkPerformanceThresholds(
    metrics: PerformanceMetrics,
    context: PerformanceContext,
    thresholds: PerformanceThresholds
  ): void {
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

  async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) {
      logger.debug('No metrics to flush');
      return;
    }

    try {
      const metricData = this.metricsBuffer.map(metrics => ({
        MetricName: 'OperationDuration',
        Value: metrics.duration,
        Unit: 'Milliseconds' as const,
        Dimensions: [
          { Name: 'Operation', Value: String(metrics.operation || 'Unknown') },
          { Name: 'Service', Value: String(metrics.service || 'Unknown') },
          {
            Name: 'Environment',
            Value: String(metrics.environment || 'Unknown'),
          },
          { Name: 'Stage', Value: String(metrics.stage || 'Unknown') },
        ],
        Timestamp: new Date(),
      }));

      // Add memory usage metrics
      const memoryMetrics = this.metricsBuffer.map(metrics => ({
        MetricName: 'MemoryUsage',
        Value: metrics.memoryUsage,
        Unit: 'Bytes' as const,
        Dimensions: [
          { Name: 'Operation', Value: String(metrics.operation || 'Unknown') },
          { Name: 'Service', Value: String(metrics.service || 'Unknown') },
          {
            Name: 'Environment',
            Value: String(metrics.environment || 'Unknown'),
          },
          { Name: 'Stage', Value: String(metrics.stage || 'Unknown') },
        ],
        Timestamp: new Date(),
      }));

      // Add success rate metrics
      const successMetrics = this.metricsBuffer.map(metrics => ({
        MetricName: 'SuccessRate',
        Value: metrics.success ? 1 : 0,
        Unit: 'Count' as const,
        Dimensions: [
          { Name: 'Operation', Value: String(metrics.operation || 'Unknown') },
          { Name: 'Service', Value: String(metrics.service || 'Unknown') },
          {
            Name: 'Environment',
            Value: String(metrics.environment || 'Unknown'),
          },
          { Name: 'Stage', Value: String(metrics.stage || 'Unknown') },
        ],
        Timestamp: new Date(),
      }));

      // Add error count metrics
      const errorMetrics = this.metricsBuffer.map(metrics => ({
        MetricName: 'ErrorCount',
        Value: metrics.errorCount,
        Unit: 'Count' as const,
        Dimensions: [
          { Name: 'Operation', Value: String(metrics.operation || 'Unknown') },
          { Name: 'Service', Value: String(metrics.service || 'Unknown') },
          {
            Name: 'Environment',
            Value: String(metrics.environment || 'Unknown'),
          },
          { Name: 'Stage', Value: String(metrics.stage || 'Unknown') },
        ],
        Timestamp: new Date(),
      }));

      const allMetrics = [
        ...metricData,
        ...memoryMetrics,
        ...successMetrics,
        ...errorMetrics,
      ];

      // CloudWatch allows max 20 metrics per request, so we need to batch them
      const batchSize = 20;
      for (let i = 0; i < allMetrics.length; i += batchSize) {
        const batch = allMetrics.slice(i, i + batchSize);

        const command = new PutMetricDataCommand({
          Namespace: this.namespace,
          MetricData: batch,
        });

        await this.cloudWatchClient.send(command);
      }

      logger.info('Performance metrics sent to CloudWatch', {
        count: this.metricsBuffer.length,
        batches: Math.ceil(allMetrics.length / batchSize),
      });

      this.metricsBuffer = [];
      this.lastFlush = new Date();
    } catch (error) {
      logger.error('Failed to send metrics to CloudWatch', {
        error: error instanceof Error ? error.message : 'Unknown error',
        metricsCount: this.metricsBuffer.length,
      });
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down performance monitoring service');

    for (const [operationId] of this.activeOperations.entries()) {
      this.completeOperation(operationId, false);
    }

    await this.flushMetrics();
  }

  private validateStandardUnit(unit: string): StandardUnit {
    const validUnits: StandardUnit[] = [
      'Seconds',
      'Microseconds',
      'Milliseconds',
      'Bytes',
      'Kilobytes',
      'Megabytes',
      'Gigabytes',
      'Terabytes',
      'Bits',
      'Kilobits',
      'Megabits',
      'Gigabits',
      'Terabits',
      'Percent',
      'Count',
      'Bytes/Second',
      'Kilobytes/Second',
      'Megabytes/Second',
      'Gigabytes/Second',
      'Terabytes/Second',
      'Bits/Second',
      'Kilobits/Second',
      'Megabits/Second',
      'Gigabits/Second',
      'Terabits/Second',
      'Count/Second',
      'None',
    ];

    return validUnits.includes(unit as StandardUnit)
      ? (unit as StandardUnit)
      : 'None';
  }

  private async sendMetricToCloudWatch(
    metricName: string,
    value: number,
    unit: string,
    context: PerformanceContext,
    additionalDimensions?: Array<{ Name: string; Value: string }>
  ): Promise<void> {
    try {
      const dimensions = [
        { Name: 'Operation', Value: String(context.operation || 'Unknown') },
        { Name: 'Service', Value: String(context.service || 'Unknown') },
        {
          Name: 'Environment',
          Value: String(context.environment || 'Unknown'),
        },
        { Name: 'Stage', Value: String(context.stage || 'Unknown') },
        ...(additionalDimensions || []),
      ];

      const standardUnit = this.validateStandardUnit(unit);

      const command = new PutMetricDataCommand({
        Namespace: this.namespace,
        MetricData: [
          {
            MetricName: metricName,
            Value: value,
            Unit: standardUnit,
            Dimensions: dimensions,
            Timestamp: new Date(),
          },
        ],
      });

      await this.cloudWatchClient.send(command);

      logger.debug('Metric sent to CloudWatch', {
        metricName,
        value,
        unit: standardUnit,
        dimensions,
      });
    } catch (error) {
      logger.error('Failed to send metric to CloudWatch', {
        metricName,
        value,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
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

    const metrics: PerformanceMetrics = {
      duration,
      memoryUsage,
      success,
      errorCount: success ? 0 : 1,
      requestSize,
      responseSize,
    };

    this.recordMetrics(metrics, data.context);

    this.activeOperations.delete(operationId);

    logger.debug('Performance monitoring completed', {
      operationId,
      operation: data.operation,
      duration,
      success,
      memoryUsage,
    });
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
