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
      appName: props.appName || 'MyAwesomeApp',
      webAssetPath: props.webAssetPath,
    });

    this.cloudFrontDomain = staticWebsite.cloudFrontDomain;

    // Optional: RUM Monitor
    if (props.rumIdentityPoolId) {
      new RumMonitor(this, 'RumMonitor', {
        environment: props.environment,
        appName: props.appName,
        domain: this.cloudFrontDomain,
        identityPoolId: props.rumIdentityPoolId,
      });
    }
  }
}
