import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
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
    const websocketApi = new apigatewayv2.WebSocketApi(this, 'WebSocketApi', {
      apiName: `awslambdahackathon-websocket-${props.environment}`,
    });

    // WebSocket Lambda integration
    const websocketIntegration =
      new apigatewayv2_integrations.WebSocketLambdaIntegration(
        'WebSocketIntegration',
        props.websocketFunction
      );

    // Add routes
    websocketApi.addRoute('$connect', {
      integration: websocketIntegration,
    });

    websocketApi.addRoute('$disconnect', {
      integration: websocketIntegration,
    });

    websocketApi.addRoute('$default', {
      integration: websocketIntegration,
    });

    // WebSocket Stage
    const stage = new apigatewayv2.WebSocketStage(this, 'WebSocketStage', {
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
