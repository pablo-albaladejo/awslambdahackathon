import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

export interface RestApiProps {
  environment: string;
  appName: string;
  mcpHostFunction: lambda.IFunction;
}

export class RestApi extends Construct {
  public readonly restApi: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: RestApiProps) {
    super(scope, id);

    // REST API Gateway
    this.restApi = new apigateway.RestApi(this, 'RestApi', {
      restApiName: `${props.appName}-api-${props.environment}`,
      description: `API Gateway for ${props.appName}`,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    // Health endpoint - Mock response
    const healthMockIntegration = new apigateway.MockIntegration({
      requestTemplates: {
        'application/json': '{"statusCode": 200}',
      },
      integrationResponses: [
        {
          statusCode: '200',
          responseTemplates: {
            'application/json': JSON.stringify({
              success: true,
              data: 'health check',
            }),
          },
        },
      ],
    });

    this.restApi.root
      .addResource('health')
      .addMethod('GET', healthMockIntegration);

    // MCP Host endpoint
    const mcpHostIntegration = new apigateway.LambdaIntegration(
      props.mcpHostFunction
    );
    this.restApi.root
      .addResource('mcp-host')
      .addMethod('POST', mcpHostIntegration);

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.restApi.url,
    });
  }
}
