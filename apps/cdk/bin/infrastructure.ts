#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';

import 'source-map-support/register';
import { ApiStack } from '../src/api-stack';
import { AuthStack } from '../src/auth-stack';
import { RumStack } from '../src/rum-stack';
import { RuntimeStack } from '../src/runtime-stack';
import { WebStack } from '../src/web-stack';

const app = new cdk.App();

const environment = process.env.ENVIRONMENT || 'dev';
const region = process.env.AWS_REGION || 'us-east-2';

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region,
};

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
const rumStack = new RumStack(app, `RumStack-${environment}`, {
  env,
  environment,
  domain: webStack.cloudFrontDomain,
  identityPoolId: authStack.identityPool.ref,
});

// Runtime Stack
const runtimeStack = new RuntimeStack(app, `RuntimeStack-${environment}`, {
  env,
  environment,
  cognitoUserPoolId: authStack.userPool.userPoolId,
  cognitoClientId: authStack.userPoolClient.userPoolClientId,
});

// API Stack
const apiStack = new ApiStack(app, `ApiStack-${environment}`, {
  env,
  environment,
  healthFunction: runtimeStack.healthFunction,
  mcpHostFunction: runtimeStack.mcpHostFunction,
  websocketConnectionFunction: runtimeStack.websocketConnectionFunction,
  websocketConversationFunction: runtimeStack.websocketConversationFunction,
  websocketAuthorizerFunction: runtimeStack.websocketAuthorizerFunction,
});

// Dependencies
rumStack.addDependency(webStack);
rumStack.addDependency(authStack);
runtimeStack.addDependency(authStack);
apiStack.addDependency(authStack);
apiStack.addDependency(webStack);
apiStack.addDependency(runtimeStack);
