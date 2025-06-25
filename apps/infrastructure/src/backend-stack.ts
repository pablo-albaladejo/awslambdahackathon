import * as path from 'path';

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

interface BackendStackProps extends cdk.StackProps {
  environment: string;
  cognitoUserPoolId: string;
  cognitoClientId: string;
}

export class BackendStack extends cdk.Stack {
  public readonly healthFunction: lambda.IFunction;
  public readonly mcpHostFunction: lambda.IFunction;
  public readonly websocketFunction: lambda.IFunction;
  public readonly websocketAuthorizerFunction: lambda.IFunction;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    // Common environment variables for all Lambda functions
    const commonEnvVars = {
      NODE_ENV: props.environment,
      ENVIRONMENT: props.environment,
      LOG_LEVEL: props.environment === 'prod' ? 'INFO' : 'DEBUG',
      POWERTOOLS_SERVICE_NAME: 'awslambdahackathon-api',
      POWERTOOLS_METRICS_NAMESPACE: 'awslambdahackathon',
      COGNITO_USER_POOL_ID: props.cognitoUserPoolId,
      COGNITO_CLIENT_ID: props.cognitoClientId,
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

    // Lambda function for /mcp-host endpoint
    this.mcpHostFunction = new NodejsFunction(this, 'McpHostFunction', {
      entry: path.join(__dirname, '../../../apps/services/src/mcp/mcp-host.ts'),
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

    // Lambda function for WebSocket connections
    this.websocketFunction = new NodejsFunction(this, 'WebSocketFunction', {
      entry: path.join(
        __dirname,
        '../../../apps/api/src/handlers/websockets/websocket.ts'
      ),
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
      memorySize: 1024, // WebSocket needs more memory
    });

    // Lambda function for WebSocket authorization
    this.websocketAuthorizerFunction = new NodejsFunction(
      this,
      'WebSocketAuthorizerFunction',
      {
        entry: path.join(
          __dirname,
          '../../../apps/api/src/handlers/websockets/websocket-authorizer.ts'
        ),
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
      }
    );
  }
}
