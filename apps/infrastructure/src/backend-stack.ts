import * as path from 'path';

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

interface BackendStackProps extends cdk.StackProps {
  environment: string;
}

export class BackendStack extends cdk.Stack {
  public readonly healthFunction: lambda.IFunction;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    // Common environment variables for all Lambda functions
    const commonEnvVars = {
      NODE_ENV: props.environment,
      ENVIRONMENT: props.environment,
      LOG_LEVEL: props.environment === 'prod' ? 'INFO' : 'DEBUG',
      POWERTOOLS_SERVICE_NAME: 'awslambdahackathon-api',
      POWERTOOLS_METRICS_NAMESPACE: 'awslambdahackathon',
    };

    // Lambda function for /health endpoint
    this.healthFunction = new NodejsFunction(this, 'HealthFunction', {
      entry: path.join(__dirname, '../../../apps/api/src/handlers/health.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: commonEnvVars,
      logRetention: logs.RetentionDays.ONE_WEEK,
      bundling: {
        externalModules: ['@aws-sdk/*'],
        minify: props.environment === 'prod',
        sourceMap: props.environment !== 'prod',
      },
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
    });
  }
}
