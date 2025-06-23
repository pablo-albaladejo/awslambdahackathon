import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rum from 'aws-cdk-lib/aws-rum';
import { Construct } from 'constructs';

export interface RumStackProps extends StackProps {
  environment: string;
  domain: string;
  identityPoolId: string;
}

export class RumStack extends Stack {
  constructor(scope: Construct, id: string, props: RumStackProps) {
    super(scope, id, props);

    const unauthRole = new iam.Role(this, 'RumUnauthenticatedRole', {
      roleName: `awslambdahackathon-rum-unauth-role-${props.environment}`,
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': props.identityPoolId,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'unauthenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    const authRole = new iam.Role(this, 'RumAuthenticatedRole', {
      roleName: `awslambdahackathon-rum-auth-role-${props.environment}`,
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': props.identityPoolId,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'authenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),
    });

    const appMonitor = new rum.CfnAppMonitor(this, 'ReactAppMonitor', {
      name: `awslambdahackathon-web-${props.environment}`,
      domain: props.domain,
      appMonitorConfiguration: {
        identityPoolId: props.identityPoolId,
        allowCookies: true,
        sessionSampleRate: 1.0,
        telemetries: ['errors', 'performance', 'http'],
      },
    });

    unauthRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['rum:PutRumEvents'],
        resources: [
          `arn:aws:rum:${this.region}:${this.account}:appmonitor/${appMonitor.name}`,
        ],
      })
    );

    authRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['rum:PutRumEvents'],
        resources: [
          `arn:aws:rum:${this.region}:${this.account}:appmonitor/${appMonitor.name}`,
        ],
      })
    );
    authRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['mobileanalytics:PutEvents', 'cognito-sync:*'],
        resources: ['*'],
      })
    );

    new cognito.CfnIdentityPoolRoleAttachment(this, 'RumPoolRoleAttachment', {
      identityPoolId: props.identityPoolId,
      roles: {
        unauthenticated: unauthRole.roleArn,
        authenticated: authRole.roleArn,
      },
    });

    new CfnOutput(this, `RumAppMonitorId${props.environment}`, {
      value: appMonitor.attrId,
      exportName: `RumAppMonitorId${props.environment}`,
    });
  }
}
