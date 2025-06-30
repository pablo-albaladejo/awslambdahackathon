import * as path from 'path';

import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

import { DatabaseTable, NodeLambda, RestApi, WebSocketApi } from './constructs';
import { CloudWatchAlarms } from './constructs/cloudwatch-alarms';

interface RuntimeStackProps extends cdk.StackProps {
  environment: string;
  appName: string;
  cognitoUserPoolId: string;
  cognitoClientId: string;
}

export class RuntimeStack extends cdk.Stack {
  public readonly websocketConnectionFunction: cdk.aws_lambda.IFunction;
  public readonly websocketConversationFunction: cdk.aws_lambda.IFunction;
  public readonly websocketApi: cdk.aws_apigatewayv2.WebSocketApi;
  public readonly restApi: cdk.aws_apigateway.RestApi;
  public readonly cloudWatchAlarms: CloudWatchAlarms;

  constructor(scope: Construct, id: string, props: RuntimeStackProps) {
    super(scope, id, props);

    // Use default app name if not provided
    const appName = props.appName || 'MyAwesomeApp';

    // WebSocket Connections table
    const websocketConnectionsTable = new DatabaseTable(
      this,
      'WebSocketConnectionsTable',
      {
        environment: props.environment,
        appName: appName,
        tableName: `${appName}-websocket-connections-${props.environment}`,
        partitionKey: {
          name: 'connectionId',
          type: dynamodb.AttributeType.STRING,
        },
        timeToLiveAttribute: 'ttl',
      }
    );

    // WebSocket Messages table
    const websocketMessagesTable = new DatabaseTable(
      this,
      'WebSocketMessagesTable',
      {
        environment: props.environment,
        appName: appName,
        tableName: `${appName}-websocket-messages-${props.environment}`,
        partitionKey: {
          name: 'sessionId',
          type: dynamodb.AttributeType.STRING,
        },
        sortKey: {
          name: 'timestamp',
          type: dynamodb.AttributeType.STRING,
        },
        timeToLiveAttribute: 'ttl',
      }
    );

    // Common environment variables for all Lambda functions
    const commonEnvVars = {
      COGNITO_USER_POOL_ID: props.cognitoUserPoolId,
      COGNITO_CLIENT_ID: props.cognitoClientId,
      WEBSOCKET_CONNECTIONS_TABLE: websocketConnectionsTable.table.tableName,
      WEBSOCKET_MESSAGES_TABLE: websocketMessagesTable.table.tableName,
    };

    // WebSocket Connection Lambda function
    const websocketConnectionLambda = new NodeLambda(
      this,
      'WebSocketConnectionFunction',
      {
        environment: props.environment,
        appName: appName,
        entry: path.join(
          __dirname,
          '../../../apps/runtime/src/infrastructure/adapters/inbound/api-gateway/websockets/connection.ts'
        ),
        description: 'WebSocket connection/disconnection handler',
        memorySize: 1024,
        environmentVariables: commonEnvVars,
      }
    );
    this.websocketConnectionFunction = websocketConnectionLambda.function;

    // WebSocket Conversation Lambda function
    const websocketConversationLambda = new NodeLambda(
      this,
      'WebSocketConversationFunction',
      {
        environment: props.environment,
        appName: appName,
        entry: path.join(
          __dirname,
          '../../../apps/runtime/src/infrastructure/adapters/inbound/api-gateway/websockets/conversation.ts'
        ),
        description: 'WebSocket message handler with Post-Connection Auth',
        memorySize: 1024,
        environmentVariables: commonEnvVars,
      }
    );
    this.websocketConversationFunction = websocketConversationLambda.function;

    // Grant DynamoDB permissions to both WebSocket functions
    websocketConnectionsTable.table.grantReadWriteData(
      this.websocketConnectionFunction
    );
    websocketMessagesTable.table.grantReadWriteData(
      this.websocketConversationFunction
    );
    websocketConnectionsTable.table.grantReadWriteData(
      this.websocketConversationFunction
    );
    websocketMessagesTable.table.grantReadWriteData(
      this.websocketConnectionFunction
    );

    // Grant CloudWatch permissions to all Lambda functions for custom metrics
    const cloudWatchPolicy = new cdk.aws_iam.PolicyStatement({
      effect: cdk.aws_iam.Effect.ALLOW,
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
    });

    this.websocketConnectionFunction.addToRolePolicy(cloudWatchPolicy);
    this.websocketConversationFunction.addToRolePolicy(cloudWatchPolicy);

    // REST API construct
    const restApi = new RestApi(this, 'RestApi', {
      environment: props.environment,
      appName,
    });
    this.restApi = restApi.restApi;
    new cdk.CfnOutput(this, 'ApiUrl', {
      exportName: `ApiUrl-${props.environment}`,
      value: restApi.restApi.url,
      description: 'API URL',
    });

    // WebSocket API construct without authorizer
    const websocketApi = new WebSocketApi(this, 'WebSocketApi', {
      environment: props.environment,
      appName,
      websocketConnectionFunction: this.websocketConnectionFunction,
      websocketConversationFunction: this.websocketConversationFunction,
    });

    this.websocketApi = websocketApi.websocketApi;
    new cdk.CfnOutput(this, 'WebSocketUrl', {
      value: websocketApi.websocketStage.url,
      description: 'WebSocket URL',
    });
    new cdk.CfnOutput(this, 'WebSocketApiId', {
      value: websocketApi.websocketApi.apiId,
      description: 'WebSocket API ID',
    });

    // CloudWatch Alarms and Monitoring
    this.cloudWatchAlarms = new CloudWatchAlarms(this, 'CloudWatchAlarms', {
      environment: props.environment,
      appName,
      namespace: appName,
      lambdaFunctions: [
        this.websocketConnectionFunction,
        this.websocketConversationFunction,
      ],
    });
  }
}
