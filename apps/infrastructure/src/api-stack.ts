import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

interface ApiStackProps extends cdk.StackProps {
  environment: string;
  healthFunction: lambda.IFunction;
  userPool: cognito.UserPool;
  cloudFrontDomain: string;
}

export class ApiStack extends cdk.Stack {
  public readonly apiUrl: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      'CognitoAuthorizer',
      {
        cognitoUserPools: [props.userPool],
        authorizerName: `awslambdahackathon-authorizer-${props.environment}`,
      }
    );

    // API Gateway
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
        ],
        allowCredentials: true,
      },
    });

    // API Gateway Resources and Methods
    const healthResource = api.root.addResource('health');
    healthResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(props.healthFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // Outputs
    this.apiUrl = new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });
  }
}
