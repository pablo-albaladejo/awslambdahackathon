import { logger } from '@awslambdahackathon/utils/lambda';
import {
  MetricData,
  MetricFilter,
  MetricsService,
} from '@domain/services/metrics-service';
import {
  CloudWatchMetric,
  CloudWatchMetricsAdapter,
} from '@infrastructure/adapters/outbound/cloudwatch';

export class CloudWatchMetricsService implements MetricsService {
  private metrics: MetricData[] = [];
  private readonly cloudWatchAdapter: CloudWatchMetricsAdapter;
  private readonly namespace: string;

  constructor(
    cloudWatchAdapter: CloudWatchMetricsAdapter,
    namespace = 'AWSLambdaHackathon/Metrics'
  ) {
    this.cloudWatchAdapter = cloudWatchAdapter;
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
      const cloudWatchMetrics: CloudWatchMetric[] = this.metrics.map(
        metric => ({
          name: metric.name,
          value: metric.value,
          unit: metric.unit,
          dimensions: metric.dimensions,
          timestamp: metric.timestamp,
        })
      );

      await this.cloudWatchAdapter.publishMetrics(
        cloudWatchMetrics,
        this.namespace
      );

      logger.info('Successfully published metrics', {
        count: this.metrics.length,
        namespace: this.namespace,
      });

      // Clear metrics after successful publication
      this.clearMetrics();
    } catch (error) {
      logger.error('Failed to publish metrics', {
        error: error instanceof Error ? error.message : String(error),
        metricsCount: this.metrics.length,
      });
      throw error;
    }
  }

  getMetrics(filter?: MetricFilter): MetricData[] {
    if (!filter) {
      return [...this.metrics];
    }

    return this.metrics.filter(metric => {
      // Filter by metric name
      if (filter.name && !metric.name.includes(filter.name)) {
        return false;
      }

      // Filter by time range
      if (
        filter.startTime &&
        metric.timestamp &&
        metric.timestamp < filter.startTime
      ) {
        return false;
      }

      if (
        filter.endTime &&
        metric.timestamp &&
        metric.timestamp > filter.endTime
      ) {
        return false;
      }

      // Filter by dimensions
      if (filter.dimensions) {
        for (const [key, value] of Object.entries(filter.dimensions)) {
          if (!metric.dimensions || metric.dimensions[key] !== value) {
            return false;
          }
        }
      }

      return true;
    });
  }

  clearMetrics(): void {
    this.metrics = [];
    logger.debug('Metrics cleared');
  }
}
