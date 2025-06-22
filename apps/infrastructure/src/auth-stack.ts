import * as path from 'path';

import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as custom_resources from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

interface AuthStackProps extends cdk.StackProps {
  environment: string;
  defaultUserEmail: string;
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `awslambdahackathon-users-${props.environment}`,
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool: this.userPool,
      authFlows: {
        userSrp: true,
      },
      preventUserExistenceErrors: true,
    });

    new cognito.CfnUserPoolGroup(this, 'AdminsGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'Admins',
      description: 'Administrators group',
    });

    new cognito.CfnUserPoolGroup(this, 'UsersGroup', {
      userPoolId: this.userPool.userPoolId,
      groupName: 'Users',
      description: 'Regular users group',
    });

    // Temporary password for default users
    const temporaryPasswordSecret = new secretsmanager.Secret(
      this,
      'DefaultUserTempPassword',
      {
        secretName: `awslambdahackathon-default-user-password-${props.environment}`,
        generateSecretString: {
          passwordLength: 16,
          excludePunctuation: false,
          includeSpace: false,
        },
      }
    );

    // Lambda to create default users
    const userCreatorLambda = new lambda.NodejsFunction(
      this,
      'DefaultUserCreator',
      {
        entry: path.join(
          __dirname,
          '../../../apps/api/src/handlers/create-cognito-user.ts'
        ),
        handler: 'handler',
        runtime: cdk.aws_lambda.Runtime.NODEJS_20_X,
        logRetention: logs.RetentionDays.ONE_WEEK,
        timeout: cdk.Duration.minutes(1),
      }
    );

    // Grant Lambda permissions to manage Cognito users and read the secret
    userCreatorLambda.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminAddUserToGroup',
        ],
        resources: [this.userPool.userPoolArn],
      })
    );
    temporaryPasswordSecret.grantRead(userCreatorLambda);

    // Custom Resource to trigger the Lambda on deploy
    new custom_resources.AwsCustomResource(this, 'DefaultUsersCustomResource', {
      onCreate: {
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: userCreatorLambda.functionName,
          Payload: JSON.stringify({
            ResourceProperties: {
              UserPoolId: this.userPool.userPoolId,
              TemporaryPasswordSecretArn: temporaryPasswordSecret.secretArn,
              Users: [
                {
                  username: 'admin_user',
                  group: 'Admins',
                  email: 'admin_user@example.com',
                },
                {
                  username: 'user_one',
                  group: 'Users',
                  email: 'user_one@example.com',
                },
                {
                  username: 'user_two',
                  group: 'Users',
                  email: 'user_two@example.com',
                },
              ],
            },
          }),
        },
        physicalResourceId: custom_resources.PhysicalResourceId.of(
          `cognito-default-users-trigger-${Date.now()}`
        ),
      },
      policy: custom_resources.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ['lambda:InvokeFunction'],
          resources: [userCreatorLambda.functionArn],
        }),
      ]),
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Outputs
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
    });
  }
}
