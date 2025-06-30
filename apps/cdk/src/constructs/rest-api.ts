import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

export interface RestApiProps {
  environment: string;
  appName: string;
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
  }
}
