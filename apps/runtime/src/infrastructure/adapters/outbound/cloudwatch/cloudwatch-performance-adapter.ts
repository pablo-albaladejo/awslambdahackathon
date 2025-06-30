import {
  CloudWatchClient,
  PutMetricDataCommand,
  StandardUnit,
} from '@aws-sdk/client-cloudwatch';
import { logger } from '@awslambdahackathon/utils/lambda';
import { Metric } from '@domain/value-objects/metric';

export interface CloudWatchPerformanceAdapter {
  publishPerformanceMetrics(
    metrics: Metric[],
    namespace?: string
  ): Promise<void>;
}

export class AwsCloudWatchPerformanceAdapter
  implements CloudWatchPerformanceAdapter
{
  private readonly client: CloudWatchClient;
  private readonly defaultNamespace: string;

  constructor(
    client: CloudWatchClient,
    namespace: string = 'AWSLambdaHackathon/Performance'
  ) {
    this.client = client;
    this.defaultNamespace = namespace;
  }

  async publishPerformanceMetrics(
    metrics: Metric[],
    namespace?: string
  ): Promise<void> {
    if (metrics.length === 0) {
      logger.debug('No performance metrics to publish');
      return;
    }

    const targetNamespace = namespace || this.defaultNamespace;

    try {
      const metricData = metrics.map(metric => ({
        MetricName: metric.name,
        Value: metric.value || (metric.duration ? metric.duration : 1),
        Unit: this.getStandardUnit(metric.unit || 'Count'),
        Dimensions: this.convertTags(metric.tags),
        Timestamp: metric.timestamp ? new Date(metric.timestamp) : new Date(),
      }));

      // CloudWatch allows max 20 metrics per request
      const batchSize = 20;
      for (let i = 0; i < metricData.length; i += batchSize) {
        const batch = metricData.slice(i, i + batchSize);

        const command = new PutMetricDataCommand({
          Namespace: targetNamespace,
          MetricData: batch,
        });

        await this.client.send(command);

        logger.debug('Published performance metrics batch to CloudWatch', {
          namespace: targetNamespace,
          batchSize: batch.length,
          totalMetrics: metrics.length,
        });
      }

      logger.info(
        'Successfully published all performance metrics to CloudWatch',
        {
          namespace: targetNamespace,
          totalMetrics: metrics.length,
        }
      );
    } catch (error) {
      logger.error('Failed to publish performance metrics to CloudWatch', {
        error: error instanceof Error ? error.message : String(error),
        namespace: targetNamespace,
        metricsCount: metrics.length,
      });
      throw error;
    }
  }

  private getStandardUnit(unit: string): StandardUnit {
    const unitMap: Record<string, StandardUnit> = {
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

  private convertTags(
    tags?: Record<string, string>
  ): Array<{ Name: string; Value: string }> {
    if (!tags) {
      return [];
    }

    return Object.entries(tags).map(([name, value]) => ({
      Name: name,
      Value: value,
    }));
  }
}
