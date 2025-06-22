#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';

import 'source-map-support/register';
import { ApiStack } from '../src/api-stack';
import { AuthStack } from '../src/auth-stack';
import { BackendStack } from '../src/backend-stack';
import { WebStack } from '../src/web-stack';

const app = new cdk.App();

// Get environment from context
const environment = app.node.tryGetContext('environment') || 'dev';

// Common props for stacks
const stackProps = {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
  environment,
};

// Backend Stack
const backendStack = new BackendStack(app, `BackendStack-${environment}`, {
  ...stackProps,
});

// Auth Stack
const authStack = new AuthStack(app, `AuthStack-${environment}`, {
  ...stackProps,
});
authStack.addDependency(backendStack);

// Web Stack (needs to be created before API Stack to get CloudFront domain)
const webStack = new WebStack(app, `WebStack-${environment}`, {
  ...stackProps,
});

// API Stack
const apiStack = new ApiStack(app, `ApiStack-${environment}`, {
  ...stackProps,
  healthFunction: backendStack.healthFunction,
  userPool: authStack.userPool,
  cloudFrontDomain: webStack.cloudFrontDomain,
});
apiStack.addDependency(authStack);
apiStack.addDependency(webStack);
