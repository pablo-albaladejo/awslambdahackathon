import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

export interface CloudWatchAlarmsProps {
  environment: string;
  appName: string;
  namespace: string;
  lambdaFunctions: cdk.aws_lambda.IFunction[];
  snsTopicArn?: string;
}

export class CloudWatchAlarms extends Construct {
  public readonly alarms: cloudwatch.Alarm[] = [];

  constructor(scope: Construct, id: string, props: CloudWatchAlarmsProps) {
    super(scope, id);

    // Create SNS topic for alarms if not provided
    const alarmTopic = props.snsTopicArn
      ? sns.Topic.fromTopicArn(this, 'AlarmTopic', props.snsTopicArn)
      : new sns.Topic(this, 'AlarmTopic', {
          topicName: `${props.appName}-alarms-${props.environment}`,
          displayName: `${props.appName} Alarms - ${props.environment}`,
        });

    // Lambda Error Rate Alarm
    const lambdaErrorAlarm = new cloudwatch.Alarm(this, 'LambdaErrorRate', {
      alarmName: `${props.appName}-lambda-error-rate-${props.environment}`,
      alarmDescription: 'Lambda function error rate is too high',
      metric: new cloudwatch.MathExpression({
        expression: 'errors / invocations * 100',
        usingMetrics: {
          errors: new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Errors',
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            dimensionsMap: {
              FunctionName: props.lambdaFunctions[0].functionName,
            },
          }),
          invocations: new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Invocations',
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            dimensionsMap: {
              FunctionName: props.lambdaFunctions[0].functionName,
            },
          }),
        },
      }),
      threshold: 5, // 5% error rate
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Lambda Duration Alarm
    const lambdaDurationAlarm = new cloudwatch.Alarm(this, 'LambdaDuration', {
      alarmName: `${props.appName}-lambda-duration-${props.environment}`,
      alarmDescription: 'Lambda function duration is too high',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/Lambda',
        metricName: 'Duration',
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
        dimensionsMap: {
          FunctionName: props.lambdaFunctions[0].functionName,
        },
      }),
      threshold: 10000, // 10 seconds
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Authentication Error Rate Alarm
    const authErrorAlarm = new cloudwatch.Alarm(
      this,
      'AuthenticationErrorRate',
      {
        alarmName: `${props.appName}-auth-error-rate-${props.environment}`,
        alarmDescription: 'Authentication error rate is too high',
        metric: new cloudwatch.Metric({
          namespace: props.namespace,
          metricName: 'authentication_failure_count',
          statistic: 'Sum',
          period: cdk.Duration.minutes(5),
          dimensionsMap: {
            Environment: props.environment,
            Service: `${props.appName}-api`,
          },
        }),
        threshold: 10, // 10 failures per 5 minutes
        evaluationPeriods: 2,
        comparisonOperator:
          cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      }
    );

    // Database Error Rate Alarm
    const dbErrorAlarm = new cloudwatch.Alarm(this, 'DatabaseErrorRate', {
      alarmName: `${props.appName}-db-error-rate-${props.environment}`,
      alarmDescription: 'Database operation error rate is too high',
      metric: new cloudwatch.Metric({
        namespace: props.namespace,
        metricName: 'database_store_connection_failure_count',
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
        dimensionsMap: {
          Environment: props.environment,
          Service: `${props.appName}-api`,
        },
      }),
      threshold: 5, // 5 failures per 5 minutes
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // WebSocket Connection Error Rate Alarm
    const wsErrorAlarm = new cloudwatch.Alarm(this, 'WebSocketErrorRate', {
      alarmName: `${props.appName}-websocket-error-rate-${props.environment}`,
      alarmDescription: 'WebSocket error rate is too high',
      metric: new cloudwatch.Metric({
        namespace: props.namespace,
        metricName: 'websocket_message_sent_failure_count',
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
        dimensionsMap: {
          Environment: props.environment,
          Service: `${props.appName}-api`,
        },
      }),
      threshold: 10, // 10 failures per 5 minutes
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // High Latency Alarm
    const highLatencyAlarm = new cloudwatch.Alarm(this, 'HighLatency', {
      alarmName: `${props.appName}-high-latency-${props.environment}`,
      alarmDescription: 'Application latency is too high',
      metric: new cloudwatch.Metric({
        namespace: props.namespace,
        metricName: 'authentication_duration',
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
        dimensionsMap: {
          Environment: props.environment,
          Service: `${props.appName}-api`,
        },
      }),
      threshold: 5000, // 5 seconds
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Low Success Rate Alarm
    const lowSuccessRateAlarm = new cloudwatch.Alarm(this, 'LowSuccessRate', {
      alarmName: `${props.appName}-low-success-rate-${props.environment}`,
      alarmDescription: 'Application success rate is too low',
      metric: new cloudwatch.MathExpression({
        expression:
          'authentication_success_count / (authentication_success_count + authentication_failure_count) * 100',
        usingMetrics: {
          authentication_success_count: new cloudwatch.Metric({
            namespace: props.namespace,
            metricName: 'authentication_success_count',
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            dimensionsMap: {
              Environment: props.environment,
              Service: `${props.appName}-api`,
            },
          }),
          authentication_failure_count: new cloudwatch.Metric({
            namespace: props.namespace,
            metricName: 'authentication_failure_count',
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            dimensionsMap: {
              Environment: props.environment,
              Service: `${props.appName}-api`,
            },
          }),
        },
      }),
      threshold: 90, // 90% success rate
      evaluationPeriods: 2,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // Add all alarms to the array
    this.alarms = [
      lambdaErrorAlarm,
      lambdaDurationAlarm,
      authErrorAlarm,
      dbErrorAlarm,
      wsErrorAlarm,
      highLatencyAlarm,
      lowSuccessRateAlarm,
    ];

    // Add SNS actions to all alarms
    this.alarms.forEach(alarm => {
      alarm.addAlarmAction(new cloudwatch_actions.SnsAction(alarmTopic));
      alarm.addOkAction(new cloudwatch_actions.SnsAction(alarmTopic));
    });

    // Create CloudWatch Dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'ApplicationDashboard', {
      dashboardName: `${props.appName}-dashboard-${props.environment}`,
    });

    // Add widgets to dashboard
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Performance',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Duration',
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
            dimensionsMap: {
              FunctionName: props.lambdaFunctions[0].functionName,
            },
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Errors',
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            dimensionsMap: {
              FunctionName: props.lambdaFunctions[0].functionName,
            },
          }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'Authentication Metrics',
        left: [
          new cloudwatch.Metric({
            namespace: props.namespace,
            metricName: 'authentication_duration',
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
            dimensionsMap: {
              Environment: props.environment,
              Service: `${props.appName}-api`,
            },
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: props.namespace,
            metricName: 'authentication_success_count',
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            dimensionsMap: {
              Environment: props.environment,
              Service: `${props.appName}-api`,
            },
          }),
          new cloudwatch.Metric({
            namespace: props.namespace,
            metricName: 'authentication_failure_count',
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            dimensionsMap: {
              Environment: props.environment,
              Service: `${props.appName}-api`,
            },
          }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'Database Operations',
        left: [
          new cloudwatch.Metric({
            namespace: props.namespace,
            metricName: 'database_store_connection_duration',
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
            dimensionsMap: {
              Environment: props.environment,
              Service: `${props.appName}-api`,
            },
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: props.namespace,
            metricName: 'database_store_connection_success_count',
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            dimensionsMap: {
              Environment: props.environment,
              Service: `${props.appName}-api`,
            },
          }),
          new cloudwatch.Metric({
            namespace: props.namespace,
            metricName: 'database_store_connection_failure_count',
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            dimensionsMap: {
              Environment: props.environment,
              Service: `${props.appName}-api`,
            },
          }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'WebSocket Metrics',
        left: [
          new cloudwatch.Metric({
            namespace: props.namespace,
            metricName: 'websocket_message_sent_duration',
            statistic: 'Average',
            period: cdk.Duration.minutes(5),
            dimensionsMap: {
              Environment: props.environment,
              Service: `${props.appName}-api`,
            },
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: props.namespace,
            metricName: 'websocket_message_sent_success_count',
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            dimensionsMap: {
              Environment: props.environment,
              Service: `${props.appName}-api`,
            },
          }),
          new cloudwatch.Metric({
            namespace: props.namespace,
            metricName: 'websocket_message_sent_failure_count',
            statistic: 'Sum',
            period: cdk.Duration.minutes(5),
            dimensionsMap: {
              Environment: props.environment,
              Service: `${props.appName}-api`,
            },
          }),
        ],
      })
    );

    // Output the dashboard URL
    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://${cdk.Stack.of(this).region}.console.aws.amazon.com/cloudwatch/home?region=${cdk.Stack.of(this).region}#dashboards:name=${props.appName}-dashboard-${props.environment}`,
      description: 'CloudWatch Dashboard URL',
    });

    // Output the SNS topic ARN
    new cdk.CfnOutput(this, 'AlarmTopicArn', {
      value: alarmTopic.topicArn,
      description: 'SNS Topic ARN for CloudWatch Alarms',
    });
  }
}
