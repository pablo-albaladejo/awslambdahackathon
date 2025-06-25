#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';

import 'source-map-support/register';
import { AuthStack } from '../src/auth-stack';
import { RuntimeStack } from '../src/runtime-stack';
import { WebStack } from '../src/web-stack';

const app = new cdk.App();

const environment = process.env.ENVIRONMENT || 'dev';
const region = process.env.AWS_REGION || 'us-east-2';
const appName = process.env.APP_NAME || 'MyAwesomeApp';

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region,
};

// Auth Stack
const authStack = new AuthStack(app, `AuthStack-${environment}`, {
  env,
  environment,
  appName,
});

// Web Stack
const webStack = new WebStack(app, `WebStack-${environment}`, {
  env,
  environment,
  appName,
  rumIdentityPoolId: authStack.identityPool.ref,
});

// Runtime Stack (includes API Gateway)
const runtimeStack = new RuntimeStack(app, `RuntimeStack-${environment}`, {
  env,
  environment,
  cognitoUserPoolId: authStack.userPool.userPoolId,
  cognitoClientId: authStack.userPoolClient.userPoolClientId,
  appName,
});

// Dependencies
runtimeStack.addDependency(authStack);
webStack.addDependency(authStack);
