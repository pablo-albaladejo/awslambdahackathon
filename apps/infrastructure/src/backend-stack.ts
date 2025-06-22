import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import * as path from 'path';

interface BackendStackProps extends cdk.StackProps {
  environment: string;
}

export class BackendStack extends cdk.Stack {
  public readonly helloFunction: lambda.IFunction;
  public readonly usersFunction: lambda.IFunction;

  constructor(scope: Construct, id: string, props: BackendStackProps) {
    super(scope, id, props);

    // DynamoDB Table for users
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: `awslambdahackathon-users-${props.environment}`,
      partitionKey: {
        name: 'id',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy:
        props.environment === 'prod'
          ? cdk.RemovalPolicy.RETAIN
          : cdk.RemovalPolicy.DESTROY,
    });

    // Lambda function for /hello endpoint
    this.helloFunction = new NodejsFunction(this, 'HelloFunction', {
      entry: path.join(__dirname, '../../../apps/api/src/handlers/hello.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: {
        NODE_ENV: props.environment,
        USERS_TABLE: usersTable.tableName,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Lambda function for /users endpoints
    this.usersFunction = new NodejsFunction(this, 'UsersFunction', {
      entry: path.join(__dirname, '../../../apps/api/src/handlers/users.ts'),
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_22_X,
      environment: {
        NODE_ENV: props.environment,
        USERS_TABLE: usersTable.tableName,
      },
      logRetention: logs.RetentionDays.ONE_WEEK,
      bundling: {
        externalModules: ['@aws-sdk/*'],
      },
    });

    // Grant DynamoDB permissions to the users Lambda function
    usersTable.grantReadWriteData(this.usersFunction);

    // Outputs
    new cdk.CfnOutput(this, 'UsersTableName', {
      value: usersTable.tableName,
      description: 'DynamoDB Users Table Name',
    });
  }
}
