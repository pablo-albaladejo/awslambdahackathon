import type { ResourcesConfig } from '@aws-amplify/core';
import { Amplify } from 'aws-amplify';

const amplifyConfig: ResourcesConfig['Auth'] = {
  Cognito: {
    userPoolId: import.meta.env.VITE_USER_POOL_ID || '',
    userPoolClientId: import.meta.env.VITE_USER_POOL_CLIENT_ID || '',
  },
};

export function configureAmplify() {
  Amplify.configure({
    Auth: amplifyConfig,
  });
}
