import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

interface ApiStackProps extends cdk.StackProps {
  environment: string;
  helloFunction: lambda.IFunction;
  usersFunction: lambda.IFunction;
}

export class ApiStack extends cdk.Stack {
  public readonly apiUrl: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // API Gateway
    const api = new apigateway.RestApi(this, 'ApiGateway', {
      restApiName: `awslambdahackathon-api-${props.environment}`,
      description: 'API for AWS Lambda Hackathon',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    // API Gateway Resources and Methods
    const helloResource = api.root.addResource('hello');
    helloResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(props.helloFunction)
    );

    const usersResource = api.root.addResource('users');
    usersResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(props.usersFunction)
    );
    usersResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(props.usersFunction)
    );

    const userResource = usersResource.addResource('{id}');
    userResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(props.usersFunction)
    );
    userResource.addMethod(
      'PUT',
      new apigateway.LambdaIntegration(props.usersFunction)
    );
    userResource.addMethod(
      'DELETE',
      new apigateway.LambdaIntegration(props.usersFunction)
    );

    // Outputs
    this.apiUrl = new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });
  }
}
