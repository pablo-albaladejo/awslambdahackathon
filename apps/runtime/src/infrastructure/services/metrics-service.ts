import {
  CloudWatchClient,
  PutMetricDataCommand,
} from '@aws-sdk/client-cloudwatch';
import { logger } from '@awslambdahackathon/utils/lambda';

export interface MetricData {
  metricName: string;
  value: number;
  unit: 'Count' | 'Seconds' | 'Percent' | 'Bytes' | 'Count/Second';
  dimensions?: Record<string, string>;
  timestamp?: Date;
}

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  success: boolean;
  errorType?: string;
  additionalDimensions?: Record<string, string>;
}

export class MetricsService {
  private readonly cloudWatchClient: CloudWatchClient;
  private readonly namespace: string;
  private readonly environment: string;
  private readonly serviceName: string;

  constructor() {
    this.cloudWatchClient = new CloudWatchClient({});
    this.namespace =
      process.env.POWERTOOLS_METRICS_NAMESPACE || 'AWSLambdaHackathon';
    this.environment = process.env.ENVIRONMENT || 'dev';
    this.serviceName =
      process.env.POWERTOOLS_SERVICE_NAME || 'websocket-service';
  }

  /**
   * Record a custom metric
   */
  async recordMetric(metricData: MetricData): Promise<void> {
    try {
      const dimensions = [
        { Name: 'Environment', Value: this.environment },
        { Name: 'Service', Value: this.serviceName },
        ...Object.entries(metricData.dimensions || {}).map(([key, value]) => ({
          Name: key,
          Value: value,
        })),
      ];

      const command = new PutMetricDataCommand({
        Namespace: this.namespace,
        MetricData: [
          {
            MetricName: metricData.metricName,
            Value: metricData.value,
            Unit: metricData.unit,
            Dimensions: dimensions,
            Timestamp: metricData.timestamp || new Date(),
          },
        ],
      });

      await this.cloudWatchClient.send(command);

      logger.debug('Metric recorded successfully', {
        metricName: metricData.metricName,
        value: metricData.value,
        unit: metricData.unit,
        dimensions: metricData.dimensions,
      });
    } catch (error) {
      logger.error('Failed to record metric', {
        metricName: metricData.metricName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Record performance metrics for operations
   */
  async recordPerformanceMetrics(metrics: PerformanceMetrics): Promise<void> {
    const baseDimensions = {
      Operation: metrics.operation,
      ...metrics.additionalDimensions,
    };

    // Record duration
    await this.recordMetric({
      metricName: `${metrics.operation}_duration`,
      value: metrics.duration,
      unit: 'Seconds',
      dimensions: baseDimensions,
    });

    // Record success/failure count
    await this.recordMetric({
      metricName: `${metrics.operation}_${metrics.success ? 'success' : 'failure'}_count`,
      value: 1,
      unit: 'Count',
      dimensions: {
        ...baseDimensions,
        ...(metrics.errorType && { ErrorType: metrics.errorType }),
      },
    });

    // Record total count
    await this.recordMetric({
      metricName: `${metrics.operation}_total_count`,
      value: 1,
      unit: 'Count',
      dimensions: baseDimensions,
    });
  }

  /**
   * Record authentication metrics
   */
  async recordAuthenticationMetrics(
    success: boolean,
    duration: number,
    errorType?: string,
    userId?: string
  ): Promise<void> {
    const dimensions: Record<string, string> = {};
    if (userId) {
      dimensions.UserId = userId;
    }

    await this.recordPerformanceMetrics({
      operation: 'authentication',
      duration,
      success,
      errorType,
      additionalDimensions: dimensions,
    });
  }

  /**
   * Record database operation metrics
   */
  async recordDatabaseMetrics(
    operation: string,
    tableName: string,
    success: boolean,
    duration: number,
    errorType?: string
  ): Promise<void> {
    await this.recordPerformanceMetrics({
      operation: `database_${operation}`,
      duration,
      success,
      errorType,
      additionalDimensions: {
        TableName: tableName,
      },
    });
  }

  /**
   * Record WebSocket connection metrics
   */
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
    await this.recordPerformanceMetrics({
      operation: `websocket_${event}`,
      duration: duration || 0,
      success,
      errorType,
    });
  }

  /**
   * Record error metrics
   */
  async recordErrorMetrics(
    errorType: string,
    operation: string,
    additionalDimensions?: Record<string, string>
  ): Promise<void> {
    await this.recordMetric({
      metricName: 'error_count',
      value: 1,
      unit: 'Count',
      dimensions: {
        ErrorType: errorType,
        Operation: operation,
        ...additionalDimensions,
      },
    });
  }

  /**
   * Record business metrics
   */
  async recordBusinessMetrics(
    metricName: string,
    value: number,
    additionalDimensions?: Record<string, string>
  ): Promise<void> {
    await this.recordMetric({
      metricName,
      value,
      unit: 'Count',
      dimensions: additionalDimensions,
    });
  }

  /**
   * Record connection count metrics
   */
  async recordConnectionCount(count: number): Promise<void> {
    await this.recordMetric({
      metricName: 'active_connections',
      value: count,
      unit: 'Count',
    });
  }

  /**
   * Record message throughput metrics
   */
  async recordMessageThroughput(
    messagesPerSecond: number,
    messageType: 'sent' | 'received'
  ): Promise<void> {
    await this.recordMetric({
      metricName: `message_throughput_${messageType}`,
      value: messagesPerSecond,
      unit: 'Count/Second',
      dimensions: {
        MessageType: messageType,
      },
    });
  }
}
