import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

interface AuthStackProps extends cdk.StackProps {
  environment: string;
  appName: string;
}

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly identityPool: cognito.CfnIdentityPool;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${props.appName}-users-${props.environment}`,
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
      allowUnauthenticatedIdentities: true,
      identityPoolName: `${props.appName}-identity-pool-${props.environment}`,
      supportedLoginProviders,
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
    new secretsmanager.Secret(this, 'DefaultUserTempPassword', {
      secretName: `${props.appName}-default-user-password-${props.environment}`,
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

    new cdk.CfnOutput(this, `IdentityPoolId${props.environment}`, {
      value: this.identityPool.ref,
      exportName: `IdentityPoolId-${props.environment}`,
    });
  }
}
