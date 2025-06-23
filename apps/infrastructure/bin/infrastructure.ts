#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';

import 'source-map-support/register';
import { ApiStack } from '../src/api-stack';
import { AuthStack } from '../src/auth-stack';
import { BackendStack } from '../src/backend-stack';
import { RumStack } from '../src/rum-stack';
import { WebStack } from '../src/web-stack';

const app = new cdk.App();

const environment = process.env.ENVIRONMENT || 'dev';
const region = process.env.AWS_REGION || 'us-east-2';

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: region,
};

// Backend Stack
const backendStack = new BackendStack(app, `BackendStack-${environment}`, {
  env,
  environment,
});

// Auth Stack
const authStack = new AuthStack(app, `AuthStack-${environment}`, {
  env,
  environment,
});

// Web Stack
const webStack = new WebStack(app, `WebStack-${environment}`, {
  env,
  environment,
});

// RUM Stack
new RumStack(app, `RumStack-${environment}`, {
  env,
  environment,
  domain: environment === 'prod' ? webStack.cloudFrontDomain : 'localhost',
});

// API Stack
const apiStack = new ApiStack(app, `ApiStack-${environment}`, {
  env,
  environment,
  userPool: authStack.userPool,
  healthFunction: backendStack.healthFunction,
  cloudFrontDomain: webStack.cloudFrontDomain,
});

// Dependencies
apiStack.addDependency(authStack);
apiStack.addDependency(webStack);
