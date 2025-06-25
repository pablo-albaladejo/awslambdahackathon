import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import {
  NodejsFunction,
  NodejsFunctionProps,
} from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface NodeLambdaProps {
  environment: string;
  appName: string;
  entry: string;
  handler?: string;
  functionName?: string;
  description?: string;
  memorySize?: number;
  timeout?: cdk.Duration;
  environmentVariables?: Record<string, string>;
  bundlingOptions?: {
    externalModules?: string[];
    minify?: boolean;
    sourceMap?: boolean;
  };
  logRetention?: logs.RetentionDays;
  removalPolicy?: cdk.RemovalPolicy;
}

export class NodeLambda extends Construct {
  public readonly function: lambda.IFunction;

  constructor(scope: Construct, id: string, props: NodeLambdaProps) {
    super(scope, id);

    // Default configuration
    const defaultEnvVars = {
      NODE_ENV: props.environment,
      ENVIRONMENT: props.environment,
      LOG_LEVEL: props.environment === 'prod' ? 'INFO' : 'DEBUG',
      POWERTOOLS_SERVICE_NAME: `${props.appName}-api`,
      POWERTOOLS_METRICS_NAMESPACE: props.appName,
    };

    // Merge default environment variables with custom ones
    const environmentVariables = {
      ...defaultEnvVars,
      ...props.environmentVariables,
    };

    // Default bundling options
    const defaultBundlingOptions = {
      externalModules: ['@aws-sdk/*'],
      minify: props.environment === 'prod',
      sourceMap: props.environment !== 'prod',
    };

    // Merge default bundling options with custom ones
    const bundlingOptions = {
      ...defaultBundlingOptions,
      ...props.bundlingOptions,
    };

    // Build the NodejsFunctionProps
    const nodejsFunctionProps: NodejsFunctionProps = {
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: environmentVariables,
      logRetention: props.logRetention || logs.RetentionDays.ONE_WEEK,
      bundling: bundlingOptions,
      timeout: props.timeout || cdk.Duration.seconds(30),
      memorySize: props.memorySize || 512,
      handler: props.handler || 'handler',
      entry: props.entry,
      functionName: props.functionName,
      description: props.description,
    };

    // Create the Lambda function
    this.function = new NodejsFunction(this, 'Function', nodejsFunctionProps);
  }
}
