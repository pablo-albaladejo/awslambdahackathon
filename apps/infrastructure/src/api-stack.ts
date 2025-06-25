import { WebSocketApi, WebSocketStage } from '@aws-cdk/aws-apigatewayv2-alpha';
import { WebSocketLambdaAuthorizer } from '@aws-cdk/aws-apigatewayv2-authorizers-alpha';
import { WebSocketLambdaIntegration } from '@aws-cdk/aws-apigatewayv2-integrations-alpha';
import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

interface ApiStackProps extends cdk.StackProps {
  environment: string;
  healthFunction: lambda.IFunction;
  mcpHostFunction: lambda.IFunction;
  websocketFunction: lambda.IFunction;
  websocketAuthorizerFunction: lambda.IFunction;
}

export class ApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // REST API Gateway
    const api = new apigateway.RestApi(this, 'ApiGateway', {
      restApiName: `awslambdahackathon-api-${props.environment}`,
      description: 'API Gateway for AWS Lambda Hackathon',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // Health endpoint
    const healthIntegration = new apigateway.LambdaIntegration(
      props.healthFunction
    );
    api.root.addResource('health').addMethod('GET', healthIntegration);

    // MCP Host endpoint
    const mcpHostIntegration = new apigateway.LambdaIntegration(
      props.mcpHostFunction
    );
    api.root.addResource('mcp-host').addMethod('POST', mcpHostIntegration);

    // WebSocket API
    const authorizer = new WebSocketLambdaAuthorizer(
      'WebSocketAuthorizer',
      props.websocketAuthorizerFunction,
      {
        identitySource: ['route.request.querystring.Authorization'],
      }
    );

    const websocketApi = new WebSocketApi(this, 'WebSocketApi', {
      apiName: `awslambdahackathon-websocket-${props.environment}`,
      connectRouteOptions: {
        integration: new WebSocketLambdaIntegration(
          'ConnectIntegration',
          props.websocketFunction
        ),
        authorizer,
      },
      disconnectRouteOptions: {
        integration: new WebSocketLambdaIntegration(
          'DisconnectIntegration',
          props.websocketFunction
        ),
      },
      defaultRouteOptions: {
        integration: new WebSocketLambdaIntegration(
          'DefaultIntegration',
          props.websocketFunction
        ),
      },
    });

    // Stage de despliegue
    const stage = new WebSocketStage(this, 'WebSocketStage', {
      webSocketApi: websocketApi,
      stageName: props.environment,
      autoDeploy: true,
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
    });

    new cdk.CfnOutput(this, 'WebSocketUrl', {
      value: stage.url,
    });
  }
}
