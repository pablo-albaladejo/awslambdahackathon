import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2_integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

interface ApiStackProps extends cdk.StackProps {
  environment: string;
  healthFunction: lambda.IFunction;
  mcpHostFunction: lambda.IFunction;
  websocketFunction: lambda.IFunction;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
  cloudFrontDomain: string;
}

export class ApiStack extends cdk.Stack {
  public readonly apiUrl: cdk.CfnOutput;
  public readonly websocketUrl: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // Cognito Authorizer for REST API
    const restAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      'CognitoAuthorizer',
      {
        cognitoUserPools: [props.userPool],
        authorizerName: `awslambdahackathon-authorizer-${props.environment}`,
      }
    );

    // REST API Gateway
    const api = new apigateway.RestApi(this, 'ApiGateway', {
      restApiName: `awslambdahackathon-api-${props.environment}`,
      description: 'API for AWS Lambda Hackathon',
      defaultCorsPreflightOptions: {
        allowOrigins: [`https://${props.cloudFrontDomain}`],
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
          'X-Amz-User-Agent',
          'X-Amz-Cognito-Identity',
        ],
        allowCredentials: true,
        maxAge: cdk.Duration.seconds(300), // Cache preflight for 5 minutes
      },
    });

    // API Gateway Resources and Methods
    const healthResource = api.root.addResource('health');
    healthResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(props.healthFunction),
      {
        authorizer: restAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // MCP Host endpoint
    const mcpHostResource = api.root.addResource('mcp-host');
    mcpHostResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(props.mcpHostFunction),
      {
        authorizer: restAuthorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // WebSocket API Gateway (without authorizer for now)
    const websocketApi = new apigatewayv2.WebSocketApi(this, 'WebSocketApi', {
      apiName: `awslambdahackathon-websocket-${props.environment}`,
      description: 'WebSocket API for Chatbot',
      connectRouteOptions: {
        integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
          'ConnectHandler',
          props.websocketFunction
        ),
      },
      disconnectRouteOptions: {
        integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
          'DisconnectHandler',
          props.websocketFunction
        ),
      },
      defaultRouteOptions: {
        integration: new apigatewayv2_integrations.WebSocketLambdaIntegration(
          'MessageHandler',
          props.websocketFunction
        ),
      },
    });

    const websocketStage = new apigatewayv2.WebSocketStage(
      this,
      'WebSocketStage',
      {
        webSocketApi: websocketApi,
        stageName: props.environment,
        autoDeploy: true,
      }
    );

    // Outputs
    this.apiUrl = new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'REST API Gateway URL',
    });

    this.websocketUrl = new cdk.CfnOutput(this, 'WebSocketUrl', {
      value: websocketStage.url,
      description: 'WebSocket API Gateway URL',
    });
  }
}
