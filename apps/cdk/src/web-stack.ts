import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { RumMonitor, StaticWebsite } from './constructs';

interface WebStackProps extends cdk.StackProps {
  environment: string;
  webAssetPath?: string;
  appName: string;
  rumIdentityPoolId?: string;
}

export class WebStack extends cdk.Stack {
  public readonly cloudFrontDomain: string;

  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);

    const staticWebsite = new StaticWebsite(this, 'StaticWebsite', {
      environment: props.environment,
      appName: props.appName,
      webAssetPath: props.webAssetPath,
    });

    this.cloudFrontDomain = staticWebsite.cloudFrontDomain;

    new cdk.CfnOutput(this, 'WebsiteBucketName', {
      value: staticWebsite.websiteBucket.bucketName,
      description: 'S3 bucket name for static website',
    });

    new cdk.CfnOutput(this, 'WebsiteUrl', {
      value: `https://${staticWebsite.distribution.distributionDomainName}`,
      description: 'CloudFront Distribution URL',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      exportName: `DistributionId`,
      value: staticWebsite.distribution.distributionId,
      description: 'CloudFront Distribution ID',
    });

    // Optional: RUM Monitor
    if (props.rumIdentityPoolId) {
      const rumMonitor = new RumMonitor(this, 'RumMonitor', {
        environment: props.environment,
        appName: props.appName,
        domain: this.cloudFrontDomain,
        identityPoolId: props.rumIdentityPoolId,
      });
      new cdk.CfnOutput(this, `RumAppMonitorId`, {
        value: rumMonitor.appMonitor.attrId,
        description: 'RUM Monitor ID',
      });
    }
  }
}
