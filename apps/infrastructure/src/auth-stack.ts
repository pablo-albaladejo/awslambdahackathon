import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

interface AuthStackProps extends cdk.StackProps {
  environment: string;
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly identityPool: cognito.CfnIdentityPool;

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

    // Identity Pool with CfnJson for dynamic keys
    const supportedLoginProviders = new cdk.CfnJson(
      this,
      'SupportedLoginProviders',
      {
        value: {
          [`cognito-idp.${cdk.Aws.REGION}.amazonaws.com/${this.userPool.userPoolId}`]:
            this.userPoolClient.userPoolClientId,
        },
      }
    );

    this.identityPool = new cognito.CfnIdentityPool(this, 'IdentityPool', {
      allowUnauthenticatedIdentities: false,
      identityPoolName: `awslambdahackathon-identity-pool-${props.environment}`,
      supportedLoginProviders: supportedLoginProviders,
    });

    const authenticatedRole = new iam.Role(
      this,
      'CognitoDefaultAuthenticatedRole',
      {
        assumedBy: new iam.FederatedPrincipal(
          'cognito-identity.amazonaws.com',
          {
            StringEquals: {
              'cognito-identity.amazonaws.com:aud': this.identityPool.ref,
            },
            'ForAnyValue:StringLike': {
              'cognito-identity.amazonaws.com:amr': 'authenticated',
            },
          },
          'sts:AssumeRoleWithWebIdentity'
        ),
      }
    );

    // Add essential permissions for Amplify credential flow and RUM
    authenticatedRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['mobileanalytics:PutEvents', 'cognito-sync:*'],
        resources: ['*'],
      })
    );

    authenticatedRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['rum:PutRumEvents'],
        resources: [
          `arn:aws:rum:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:appmonitor/${`awslambdahackathon-web-${props.environment}`}/*`,
        ],
      })
    );

    new cognito.CfnIdentityPoolRoleAttachment(
      this,
      'IdentityPoolRoleAttachment',
      {
        identityPoolId: this.identityPool.ref,
        roles: {
          authenticated: authenticatedRole.roleArn,
        },
      }
    );

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
    new secretsmanager.Secret(this, 'DefaultUserTempPassword', {
      secretName: `awslambdahackathon-default-user-password-${props.environment}`,
      generateSecretString: {
        passwordLength: 16,
        excludePunctuation: false,
        includeSpace: false,
      },
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
