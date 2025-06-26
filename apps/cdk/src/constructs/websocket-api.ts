import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface WebSocketApiProps {
  environment: string;
  appName: string;
  websocketConnectionFunction: lambda.IFunction;
  websocketConversationFunction: lambda.IFunction;
}

export class WebSocketApi extends Construct {
  public readonly websocketApi: apigatewayv2.WebSocketApi;

  constructor(scope: Construct, id: string, props: WebSocketApiProps) {
    super(scope, id);

    // WebSocket API without authorizer for Post-Connection Auth
    this.websocketApi = new apigatewayv2.WebSocketApi(this, 'WebSocketApi', {
      apiName: `${props.appName}-websocket-${props.environment}`,
    });

    // WebSocket Lambda integrations
    const websocketConnectionIntegration =
      new apigatewayv2_integrations.WebSocketLambdaIntegration(
        'WebSocketConnectionIntegration',
        props.websocketConnectionFunction
      );
    const websocketConversationIntegration =
      new apigatewayv2_integrations.WebSocketLambdaIntegration(
        'WebSocketConversationIntegration',
        props.websocketConversationFunction
      );

    // Add routes without authorizer
    this.websocketApi.addRoute('$connect', {
      integration: websocketConnectionIntegration,
    });
    this.websocketApi.addRoute('$disconnect', {
      integration: websocketConnectionIntegration,
    });
    this.websocketApi.addRoute('$default', {
      integration: websocketConversationIntegration,
    });

    // WebSocket Stage
    const stage = new apigatewayv2.WebSocketStage(this, 'WebSocketStage', {
      webSocketApi: this.websocketApi,
      stageName: props.environment,
      autoDeploy: true,
    });

    // Grant WebSocket API permissions to Lambda functions
    const websocketApiArn = `arn:aws:execute-api:${this.node.tryGetContext('region') || 'us-east-2'}:${this.node.tryGetContext('account') || '*'}:${this.websocketApi.apiId}/*`;

    // Grant permissions to conversation function to send messages
    props.websocketConversationFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['execute-api:ManageConnections'],
        resources: [websocketApiArn],
      })
    );

    // Grant permissions to connection function to manage connections
    props.websocketConnectionFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['execute-api:ManageConnections'],
        resources: [websocketApiArn],
      })
    );

    // Outputs
    new cdk.CfnOutput(this, 'WebSocketUrl', {
      value: stage.url,
    });

    new cdk.CfnOutput(this, 'WebSocketApiId', {
      value: this.websocketApi.apiId,
      exportName: `${props.appName}-WebSocketApiId-${props.environment}`,
    });
  }
}
