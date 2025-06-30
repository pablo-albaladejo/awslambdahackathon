import {
  CloudWatchClient,
  PutMetricDataCommand,
  StandardUnit,
} from '@aws-sdk/client-cloudwatch';
import { Metric } from '@domain/value-objects/metric';
import { BaseAdapter } from '@infrastructure/adapters/base/base-adapter';

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

export class AwsCloudWatchMetricsAdapter extends BaseAdapter {
  private static readonly SERVICE_NAME = 'CloudWatch';
  private static readonly NAMESPACE = 'AWSLambdaHackathon';

  constructor(private readonly client: CloudWatchClient) {
    super();
  }

  private getStandardUnit(unit?: string): StandardUnit {
    switch (unit?.toLowerCase()) {
      case 'seconds':
        return StandardUnit.Seconds;
      case 'milliseconds':
        return StandardUnit.Milliseconds;
      case 'microseconds':
        return StandardUnit.Microseconds;
      case 'count':
        return StandardUnit.Count;
      case 'percent':
        return StandardUnit.Percent;
      case 'bytes':
        return StandardUnit.Bytes;
      case 'kilobytes':
        return StandardUnit.Kilobytes;
      case 'megabytes':
        return StandardUnit.Megabytes;
      case 'gigabytes':
        return StandardUnit.Gigabytes;
      default:
        return StandardUnit.Count;
    }
  }

  async putMetric(metric: Metric): Promise<void> {
    return this.executeWithErrorHandling(
      'putMetric',
      AwsCloudWatchMetricsAdapter.SERVICE_NAME,
      async () => {
        const command = new PutMetricDataCommand({
          Namespace: AwsCloudWatchMetricsAdapter.NAMESPACE,
          MetricData: [
            {
              MetricName: metric.name,
              Value: metric.value || 0,
              Unit: this.getStandardUnit(metric.unit),
              Timestamp: metric.timestamp
                ? new Date(metric.timestamp)
                : new Date(),
              Dimensions: metric.tags
                ? Object.entries(metric.tags).map(([name, value]) => ({
                    Name: name,
                    Value: value,
                  }))
                : undefined,
            },
          ],
        });

        await this.client.send(command);
      },
      { metricName: metric.name, value: metric.value }
    );
  }

  async putMetrics(metrics: Metric[]): Promise<void> {
    return this.executeWithErrorHandling(
      'putMetrics',
      AwsCloudWatchMetricsAdapter.SERVICE_NAME,
      async () => {
        const command = new PutMetricDataCommand({
          Namespace: AwsCloudWatchMetricsAdapter.NAMESPACE,
          MetricData: metrics.map(metric => ({
            MetricName: metric.name,
            Value: metric.value || 0,
            Unit: this.getStandardUnit(metric.unit),
            Timestamp: metric.timestamp
              ? new Date(metric.timestamp)
              : new Date(),
            Dimensions: metric.tags
              ? Object.entries(metric.tags).map(([name, value]) => ({
                  Name: name,
                  Value: value,
                }))
              : undefined,
          })),
        });

        await this.client.send(command);
      },
      { metricsCount: metrics.length }
    );
  }

  // Backward compatibility method
  async publishMetrics(
    metrics: CloudWatchMetric[],
    _namespace: string
  ): Promise<void> {
    void _namespace; // Namespace is fixed in this implementation
    const convertedMetrics: Metric[] = metrics.map(metric => ({
      name: metric.name,
      type: 'business',
      tags: metric.dimensions || {},
      value: metric.value,
      unit: metric.unit,
      timestamp: metric.timestamp?.getTime(),
    }));

    return this.putMetrics(convertedMetrics);
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
