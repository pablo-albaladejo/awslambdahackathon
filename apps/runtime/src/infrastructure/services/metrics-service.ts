import {
  CloudWatchClient,
  PutMetricDataCommand,
  StandardUnit,
} from '@aws-sdk/client-cloudwatch';
import { logger } from '@awslambdahackathon/utils/lambda';

import {
  MetricData,
  MetricFilter,
  MetricsService,
} from '@/application/services/metrics-service';

export class CloudWatchMetricsService implements MetricsService {
  private metrics: MetricData[] = [];
  private readonly cloudWatchClient: CloudWatchClient;
  private readonly namespace: string;

  constructor(namespace = 'AWSLambdaHackathon/Metrics') {
    this.cloudWatchClient = new CloudWatchClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    this.namespace = namespace;
  }

  recordMetric(
    name: string,
    value: number,
    unit?: string,
    dimensions?: Record<string, string>
  ): void {
    const metric: MetricData = {
      name,
      value,
      unit,
      timestamp: new Date(),
      dimensions,
    };

    this.metrics.push(metric);

    logger.debug('Metric recorded', {
      name,
      value,
      unit,
      dimensions,
    });
  }

  recordCount(
    name: string,
    count: number = 1,
    dimensions?: Record<string, string>
  ): void {
    this.recordMetric(name, count, 'Count', dimensions);
  }

  recordDuration(
    name: string,
    durationMs: number,
    dimensions?: Record<string, string>
  ): void {
    this.recordMetric(name, durationMs, 'Milliseconds', dimensions);
  }

  recordError(
    name: string,
    errorType: string,
    dimensions?: Record<string, string>
  ): void {
    this.recordMetric(name, 1, 'Count', {
      ...dimensions,
      errorType,
    });
  }

  async recordErrorMetrics(
    errorType: string,
    operation: string,
    additionalDimensions?: Record<string, string>
  ): Promise<void> {
    this.recordMetric('error_count', 1, 'Count', {
      ErrorType: errorType,
      Operation: operation,
      ...additionalDimensions,
    });
  }

  async recordBusinessMetrics(
    metricName: string,
    value: number,
    additionalDimensions?: Record<string, string>
  ): Promise<void> {
    this.recordMetric(metricName, value, 'Count', additionalDimensions);
  }

  async recordWebSocketMetrics(
    event:
      | 'connect'
      | 'disconnect'
      | 'message_sent'
      | 'message_received'
      | 'ping'
      | 'message_processed',
    success: boolean,
    duration?: number,
    errorType?: string
  ): Promise<void> {
    const dimensions: Record<string, string> = {
      Event: event,
      Success: success.toString(),
    };

    if (errorType) {
      dimensions.ErrorType = errorType;
    }

    this.recordMetric(`websocket_${event}`, 1, 'Count', dimensions);

    if (duration !== undefined) {
      this.recordMetric(
        `websocket_${event}_duration`,
        duration,
        'Milliseconds',
        dimensions
      );
    }
  }

  async recordDatabaseMetrics(
    operation: string,
    tableName: string,
    success: boolean,
    duration: number,
    errorType?: string
  ): Promise<void> {
    const dimensions: Record<string, string> = {
      Operation: operation,
      TableName: tableName,
      Success: success.toString(),
    };

    if (errorType) {
      dimensions.ErrorType = errorType;
    }

    this.recordMetric(`database_${operation}`, 1, 'Count', dimensions);
    this.recordMetric(
      `database_${operation}_duration`,
      duration,
      'Milliseconds',
      dimensions
    );
  }

  async recordAuthenticationMetrics(
    success: boolean,
    duration: number,
    errorType?: string,
    userId?: string
  ): Promise<void> {
    const dimensions: Record<string, string> = {
      Success: success.toString(),
    };

    if (errorType) {
      dimensions.ErrorType = errorType;
    }

    if (userId) {
      dimensions.UserId = userId;
    }

    this.recordMetric('authentication', 1, 'Count', dimensions);
    this.recordMetric(
      'authentication_duration',
      duration,
      'Milliseconds',
      dimensions
    );
  }

  async publishMetrics(): Promise<void> {
    if (this.metrics.length === 0) {
      logger.debug('No metrics to publish');
      return;
    }

    try {
      const metricData = this.metrics.map(metric => ({
        MetricName: metric.name,
        Value: metric.value,
        Unit: this.validateStandardUnit(metric.unit || 'None'),
        Dimensions: this.convertDimensions(metric.dimensions),
        Timestamp: metric.timestamp,
      }));

      // CloudWatch allows max 20 metrics per request, so we need to batch them
      const batchSize = 20;
      for (let i = 0; i < metricData.length; i += batchSize) {
        const batch = metricData.slice(i, i + batchSize);

        const command = new PutMetricDataCommand({
          Namespace: this.namespace,
          MetricData: batch,
        });

        await this.cloudWatchClient.send(command);
      }

      logger.info('Metrics sent to CloudWatch', {
        count: this.metrics.length,
        batches: Math.ceil(metricData.length / batchSize),
        namespace: this.namespace,
      });

      this.metrics = [];
    } catch (error) {
      logger.error('Failed to send metrics to CloudWatch', {
        error: error instanceof Error ? error.message : 'Unknown error',
        metricsCount: this.metrics.length,
        namespace: this.namespace,
      });
      throw error;
    }
  }

  getMetrics(filter?: MetricFilter): MetricData[] {
    let filteredMetrics = [...this.metrics];

    if (filter?.name) {
      filteredMetrics = filteredMetrics.filter(
        metric => metric.name === filter.name
      );
    }

    if (filter?.startTime) {
      filteredMetrics = filteredMetrics.filter(
        metric => metric.timestamp && metric.timestamp >= filter.startTime!
      );
    }

    if (filter?.endTime) {
      filteredMetrics = filteredMetrics.filter(
        metric => metric.timestamp && metric.timestamp <= filter.endTime!
      );
    }

    if (filter?.dimensions) {
      filteredMetrics = filteredMetrics.filter(metric => {
        if (!metric.dimensions) return false;
        return Object.entries(filter.dimensions!).every(
          ([key, value]) => metric.dimensions![key] === value
        );
      });
    }

    return filteredMetrics;
  }

  clearMetrics(): void {
    this.metrics = [];
    logger.debug('Metrics cleared');
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

  private convertDimensions(
    dimensions?: Record<string, string>
  ): Array<{ Name: string; Value: string }> {
    if (!dimensions) {
      return [];
    }

    return Object.entries(dimensions).map(([key, value]) => ({
      Name: key,
      Value: String(value),
    }));
  }
}
