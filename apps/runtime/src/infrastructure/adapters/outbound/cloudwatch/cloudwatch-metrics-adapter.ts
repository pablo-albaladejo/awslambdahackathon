import {
  CloudWatchClient,
  PutMetricDataCommand,
  StandardUnit,
} from '@aws-sdk/client-cloudwatch';
import { logger } from '@awslambdahackathon/utils/lambda';

export interface CloudWatchMetric {
  name: string;
  value: number;
  unit?: string;
  dimensions?: Record<string, string>;
  timestamp?: Date;
}

export interface CloudWatchMetricsAdapter {
  publishMetrics(metrics: CloudWatchMetric[], namespace: string): Promise<void>;
}

export class AwsCloudWatchMetricsAdapter implements CloudWatchMetricsAdapter {
  private readonly client: CloudWatchClient;

  constructor() {
    this.client = new CloudWatchClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }

  async publishMetrics(
    metrics: CloudWatchMetric[],
    namespace: string
  ): Promise<void> {
    if (metrics.length === 0) {
      logger.debug('No metrics to publish');
      return;
    }

    try {
      const metricData = metrics.map(metric => ({
        MetricName: metric.name,
        Value: metric.value,
        Unit: this.validateStandardUnit(metric.unit || 'None'),
        Dimensions: this.convertDimensions(metric.dimensions),
        Timestamp: metric.timestamp || new Date(),
      }));

      // CloudWatch allows max 20 metrics per request, so we need to batch them
      const batchSize = 20;
      for (let i = 0; i < metricData.length; i += batchSize) {
        const batch = metricData.slice(i, i + batchSize);

        const command = new PutMetricDataCommand({
          Namespace: namespace,
          MetricData: batch,
        });

        await this.client.send(command);

        logger.debug('Published metrics batch to CloudWatch', {
          namespace,
          batchSize: batch.length,
          totalMetrics: metrics.length,
        });
      }

      logger.info('Successfully published all metrics to CloudWatch', {
        namespace,
        totalMetrics: metrics.length,
      });
    } catch (error) {
      logger.error('Failed to publish metrics to CloudWatch', {
        error: error instanceof Error ? error.message : String(error),
        namespace,
        metricsCount: metrics.length,
      });
      throw error;
    }
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

    const standardUnit = validUnits.find(
      validUnit => validUnit.toLowerCase() === unit.toLowerCase()
    );

    return standardUnit || 'None';
  }

  private convertDimensions(
    dimensions?: Record<string, string>
  ): Array<{ Name: string; Value: string }> {
    if (!dimensions) {
      return [];
    }

    return Object.entries(dimensions).map(([name, value]) => ({
      Name: name,
      Value: value,
    }));
  }
}
