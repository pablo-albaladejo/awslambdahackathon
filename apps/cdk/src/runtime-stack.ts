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
  public readonly llmServiceFunction: cdk.aws_lambda.IFunction;
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

    // WebSocket Sessions table (separate table for user sessions)
    const websocketSessionsTable = new DatabaseTable(
      this,
      'WebSocketSessionsTable',
      {
        environment: props.environment,
        appName: appName,
        tableName: `${appName}-websocket-sessions-${props.environment}`,
        partitionKey: {
          name: 'pk',
          type: dynamodb.AttributeType.STRING,
        },
        sortKey: {
          name: 'sk',
          type: dynamodb.AttributeType.STRING,
        },
        timeToLiveAttribute: 'ttl',
      }
    );

    // Add Global Secondary Index for userId queries on sessions table
    websocketSessionsTable.table.addGlobalSecondaryIndex({
      indexName: 'userId-index',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

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

    // Add Global Secondary Index for userId queries (needed for session repository)
    websocketMessagesTable.table.addGlobalSecondaryIndex({
      indexName: 'userId-index',
      partitionKey: {
        name: 'userId',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'timestamp',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Create LLM Service Lambda function first (needed for function name reference)
    const llmServiceLambda = new NodeLambda(this, 'LLMServiceFunction', {
      environment: props.environment,
      appName: appName,
      entry: path.join(
        __dirname,
        '../../../apps/runtime/src/handlers/llm-service-handler.ts'
      ),
      description: 'LLM Service using Amazon Nova Micro via Bedrock',
      memorySize: 2048, // Larger memory for LLM processing
      timeout: cdk.Duration.minutes(5), // Longer timeout for LLM calls
      environmentVariables: {
        // Basic environment variables
        COGNITO_USER_POOL_ID: props.cognitoUserPoolId,
        COGNITO_CLIENT_ID: props.cognitoClientId,
        WEBSOCKET_CONNECTIONS_TABLE: websocketConnectionsTable.table.tableName,
        WEBSOCKET_MESSAGES_TABLE: websocketMessagesTable.table.tableName,
        // Bedrock specific environment variables
        BEDROCK_REGION: props.env?.region || 'us-east-2',
        DEFAULT_LLM_MODEL: 'nova-micro',
      },
    });
    this.llmServiceFunction = llmServiceLambda.function;

    // Common environment variables for all Lambda functions
    const commonEnvVars = {
      // Authentication
      COGNITO_USER_POOL_ID: props.cognitoUserPoolId,
      COGNITO_CLIENT_ID: props.cognitoClientId,
      // Database tables - three separate tables
      WEBSOCKET_CONNECTIONS_TABLE: websocketConnectionsTable.table.tableName,
      WEBSOCKET_SESSIONS_TABLE: websocketSessionsTable.table.tableName,
      WEBSOCKET_MESSAGES_TABLE: websocketMessagesTable.table.tableName,
      // LLM Service
      LLM_FUNCTION_NAME: this.llmServiceFunction.functionName,
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

    // Grant DynamoDB permissions to WebSocket functions for all three tables
    websocketConnectionsTable.table.grantReadWriteData(
      this.websocketConnectionFunction
    );
    websocketConnectionsTable.table.grantReadWriteData(
      this.websocketConversationFunction
    );
    websocketSessionsTable.table.grantReadWriteData(
      this.websocketConnectionFunction
    );
    websocketSessionsTable.table.grantReadWriteData(
      this.websocketConversationFunction
    );
    websocketMessagesTable.table.grantReadWriteData(
      this.websocketConnectionFunction
    );
    websocketMessagesTable.table.grantReadWriteData(
      this.websocketConversationFunction
    );

    // Grant explicit permissions for DynamoDB Query operations on GSI indexes
    const dynamoDBQueryPolicy = new cdk.aws_iam.PolicyStatement({
      effect: cdk.aws_iam.Effect.ALLOW,
      actions: [
        'dynamodb:Query',
        'dynamodb:GetItem',
        'dynamodb:PutItem',
        'dynamodb:UpdateItem',
        'dynamodb:DeleteItem',
        'dynamodb:Scan',
      ],
      resources: [
        websocketConnectionsTable.table.tableArn,
        websocketSessionsTable.table.tableArn,
        websocketMessagesTable.table.tableArn,
        `${websocketConnectionsTable.table.tableArn}/index/*`,
        `${websocketSessionsTable.table.tableArn}/index/*`,
        `${websocketMessagesTable.table.tableArn}/index/*`,
      ],
    });

    this.websocketConnectionFunction.addToRolePolicy(dynamoDBQueryPolicy);
    this.websocketConversationFunction.addToRolePolicy(dynamoDBQueryPolicy);
    this.llmServiceFunction.addToRolePolicy(dynamoDBQueryPolicy);

    // Grant CloudWatch permissions to all Lambda functions for custom metrics
    const cloudWatchPolicy = new cdk.aws_iam.PolicyStatement({
      effect: cdk.aws_iam.Effect.ALLOW,
      actions: ['cloudwatch:PutMetricData'],
      resources: ['*'],
    });

    this.websocketConnectionFunction.addToRolePolicy(cloudWatchPolicy);
    this.websocketConversationFunction.addToRolePolicy(cloudWatchPolicy);
    this.llmServiceFunction.addToRolePolicy(cloudWatchPolicy);

    // Grant Bedrock access to LLM function for Nova models
    const bedrockPolicy = new cdk.aws_iam.PolicyStatement({
      effect: cdk.aws_iam.Effect.ALLOW,
      actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
      resources: [
        // Nova models
        `arn:aws:bedrock:${this.region}::foundation-model/amazon.nova-micro-v1:0`,
        `arn:aws:bedrock:${this.region}::foundation-model/amazon.nova-lite-v1:0`,
        `arn:aws:bedrock:${this.region}::foundation-model/amazon.nova-pro-v1:0`,
        // Claude models (fallback support)
        `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-haiku-20240307-v1:0`,
        `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0`,
        `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-opus-20240229-v1:0`,
      ],
    });
    this.llmServiceFunction.addToRolePolicy(bedrockPolicy);

    // Grant Lambda invoke permissions for WebSocket functions to call LLM service
    const lambdaInvokePolicy = new cdk.aws_iam.PolicyStatement({
      effect: cdk.aws_iam.Effect.ALLOW,
      actions: ['lambda:InvokeFunction'],
      resources: [this.llmServiceFunction.functionArn],
    });
    this.websocketConversationFunction.addToRolePolicy(lambdaInvokePolicy);

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

    // Update Lambda functions with WebSocket endpoint
    (
      this.websocketConnectionFunction as cdk.aws_lambda.Function
    ).addEnvironment('WEBSOCKET_ENDPOINT', websocketApi.websocketStage.url);
    (
      this.websocketConversationFunction as cdk.aws_lambda.Function
    ).addEnvironment('WEBSOCKET_ENDPOINT', websocketApi.websocketStage.url);

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
        this.llmServiceFunction,
      ],
    });

    // Output LLM Function Name for reference
    new cdk.CfnOutput(this, 'LLMFunctionName', {
      exportName: `LLMFunctionName-${props.environment}`,
      value: this.llmServiceFunction.functionName,
      description: 'LLM Service Lambda Function Name',
    });
  }
}
