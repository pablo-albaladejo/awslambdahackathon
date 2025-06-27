import * as path from 'path';

import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

import { DatabaseTable, NodeLambda, RestApi, WebSocketApi } from './constructs';

interface RuntimeStackProps extends cdk.StackProps {
  environment: string;
  appName: string;
  cognitoUserPoolId: string;
  cognitoClientId: string;
}

export class RuntimeStack extends cdk.Stack {
  public readonly mcpHostFunction: cdk.aws_lambda.IFunction;
  public readonly websocketConnectionFunction: cdk.aws_lambda.IFunction;
  public readonly websocketConversationFunction: cdk.aws_lambda.IFunction;
  public readonly websocketApi: cdk.aws_apigatewayv2.WebSocketApi;
  public readonly restApi: cdk.aws_apigateway.RestApi;

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

    // MCP Host Lambda function
    const mcpHostLambda = new NodeLambda(this, 'McpHostFunction', {
      environment: props.environment,
      appName: appName,
      entry: path.join(__dirname, '../../../apps/runtime/src/mcp/mcp-host.ts'),
      description: 'MCP Host endpoint handler',
      environmentVariables: commonEnvVars,
    });
    this.mcpHostFunction = mcpHostLambda.function;

    // WebSocket Connection Lambda function
    const websocketConnectionLambda = new NodeLambda(
      this,
      'WebSocketConnectionFunction',
      {
        environment: props.environment,
        appName: appName,
        entry: path.join(
          __dirname,
          '../../../apps/runtime/src/entry-points/handlers/websockets/connection.ts'
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
          '../../../apps/runtime/src/entry-points/handlers/websockets/conversation.ts'
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

    // Grant DynamoDB permissions to MCP Host function for authentication
    websocketConnectionsTable.table.grantReadWriteData(this.mcpHostFunction);

    // REST API construct
    const restApi = new RestApi(this, 'RestApi', {
      environment: props.environment,
      appName,
      mcpHostFunction: this.mcpHostFunction,
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
  }
}
