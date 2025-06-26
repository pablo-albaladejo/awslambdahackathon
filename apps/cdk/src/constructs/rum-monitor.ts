import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as rum from 'aws-cdk-lib/aws-rum';
import { Construct } from 'constructs';

export interface RumMonitorProps {
  environment: string;
  appName: string;
  domain: string;
  identityPoolId: string;
}

export class RumMonitor extends Construct {
  public readonly appMonitor: rum.CfnAppMonitor;
  public readonly unauthRole: iam.Role;
  public readonly authRole: iam.Role;

  constructor(scope: Construct, id: string, props: RumMonitorProps) {
    super(scope, id);

    this.unauthRole = new iam.Role(this, 'RumUnauthenticatedRole', {
      roleName: `${props.appName}-rum-unauth-role-${props.environment}`,
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

    this.authRole = new iam.Role(this, 'RumAuthenticatedRole', {
      roleName: `${props.appName}-rum-auth-role-${props.environment}`,
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

    this.appMonitor = new rum.CfnAppMonitor(this, 'ReactAppMonitor', {
      name: `${props.appName}-web-${props.environment}`,
      domain: props.domain,
      customEvents: { status: 'ENABLED' },
      cwLogEnabled: true,
      appMonitorConfiguration: {
        identityPoolId: props.identityPoolId,
        allowCookies: true,
        sessionSampleRate: 1.0,
        telemetries: ['errors', 'performance', 'http'],
      },
    });

    this.unauthRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['rum:PutRumEvents'],
        resources: [
          `arn:aws:rum:${scope.node.tryGetContext('region') || 'us-east-2'}:${scope.node.tryGetContext('account') || '*'}:appmonitor/${this.appMonitor.name}`,
        ],
      })
    );

    this.authRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['rum:PutRumEvents'],
        resources: [
          `arn:aws:rum:${scope.node.tryGetContext('region') || 'us-east-2'}:${scope.node.tryGetContext('account') || '*'}:appmonitor/${this.appMonitor.name}`,
        ],
      })
    );
    this.authRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['mobileanalytics:PutEvents', 'cognito-sync:*'],
        resources: ['*'],
      })
    );

    new cognito.CfnIdentityPoolRoleAttachment(this, 'RumPoolRoleAttachment', {
      identityPoolId: props.identityPoolId,
      roles: {
        unauthenticated: this.unauthRole.roleArn,
        authenticated: this.authRole.roleArn,
      },
    });
  }
}
