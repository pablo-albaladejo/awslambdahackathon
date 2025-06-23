import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rum from 'aws-cdk-lib/aws-rum';
import { Construct } from 'constructs';

export interface RumStackProps extends StackProps {
  environment: string;
  domain?: string;
}

export class RumStack extends Stack {
  public readonly appMonitorId: string;
  public readonly identityPoolId: string;
  public readonly guestRoleArn: string;

  constructor(scope: Construct, id: string, props: RumStackProps) {
    super(scope, id, props);

    const identityPool = new cognito.CfnIdentityPool(this, 'RumIdentityPool', {
      allowUnauthenticatedIdentities: true,
      identityPoolName: `awslambdahackathon-rum-identity-pool-${props.environment}`,
    });

    const unauthRole = new iam.Role(this, 'RumUnauthenticatedRole', {
      roleName: `awslambdahackathon-rum-unauth-role-${props.environment}`,
      assumedBy: new iam.FederatedPrincipal(
        'cognito-identity.amazonaws.com',
        {
          StringEquals: {
            'cognito-identity.amazonaws.com:aud': identityPool.ref,
          },
          'ForAnyValue:StringLike': {
            'cognito-identity.amazonaws.com:amr': 'unauthenticated',
          },
        },
        'sts:AssumeRoleWithWebIdentity'
      ),

      inlinePolicies: {
        RumPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ['rum:PutRumEvents', 'rum:PutRumMetrics'],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    new cognito.CfnIdentityPoolRoleAttachment(this, 'RoleAttachment', {
      identityPoolId: identityPool.ref,
      roles: {
        unauthenticated: unauthRole.roleArn,
      },
    });

    const appMonitor = new rum.CfnAppMonitor(this, 'ReactAppMonitor', {
      name: `awslambdahackathon-web-${props.environment}`,
      domain: props.domain || 'localhost',
      appMonitorConfiguration: {
        allowCookies: true,
        enableXRay: true,
        guestRoleArn: unauthRole.roleArn,
        identityPoolId: identityPool.ref,
        sessionSampleRate: 1.0,
        telemetries: ['errors', 'performance', 'http'],
      },
    });

    this.appMonitorId = appMonitor.name;
    this.identityPoolId = identityPool.ref;
    this.guestRoleArn = unauthRole.roleArn;

    new CfnOutput(this, 'RumAppMonitorId', {
      value: this.appMonitorId,
      exportName: `RumAppMonitorId-${props.environment}`,
    });

    new CfnOutput(this, 'RumIdentityPoolId', {
      value: this.identityPoolId,
      exportName: `RumIdentityPoolId-${props.environment}`,
    });

    new CfnOutput(this, 'RumGuestRoleArn', {
      value: this.guestRoleArn,
      exportName: `RumGuestRoleArn-${props.environment}`,
    });
  }
}
