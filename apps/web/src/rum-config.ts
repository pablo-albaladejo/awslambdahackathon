// CloudWatch RUM Configuration
// This file contains the configuration for AWS CloudWatch RUM
// which provides real-time monitoring of frontend applications

import { AwsRum, logger } from '@awslambdahackathon/utils/frontend';

export interface RUMConfig {
  applicationId: string;
  applicationVersion: string;
  applicationRegion: string;
  guestRoleArn: string;
  identityPoolId: string;
  endpoint: string;
  sessionSampleRate: number;
  telemetries: string[];
  allowCookies: boolean;
}

// Default configuration - replace with your actual values
export const defaultRUMConfig: RUMConfig = {
  applicationId: process.env.VITE_RUM_APPLICATION_ID || '',
  applicationVersion: process.env.VITE_RUM_APPLICATION_VERSION || '1.0.0',
  applicationRegion: process.env.VITE_RUM_APPLICATION_REGION || 'us-east-1',
  guestRoleArn: process.env.VITE_RUM_GUEST_ROLE_ARN || '',
  identityPoolId: process.env.VITE_RUM_IDENTITY_POOL_ID || '',
  endpoint:
    process.env.VITE_RUM_ENDPOINT ||
    'https://dataplane.rum.us-east-1.amazonaws.com',
  sessionSampleRate: 1, // 100% of sessions
  telemetries: ['errors', 'performance', 'http'],
  allowCookies: true,
};

// Initialize CloudWatch RUM
export const initializeRUM = async (config: RUMConfig = defaultRUMConfig) => {
  if (typeof window === 'undefined') return;

  try {
    // Dynamic import to avoid bundling in SSR
    const { AwsRum } = await import('aws-rum-web');

    const awsRum = new AwsRum(
      config.applicationId,
      config.applicationVersion,
      config.applicationRegion,
      {
        sessionSampleRate: config.sessionSampleRate,
        guestRoleArn: config.guestRoleArn,
        identityPoolId: config.identityPoolId,
        endpoint: config.endpoint,
        telemetries: config.telemetries,
        allowCookies: config.allowCookies,
      }
    );

    // Make it globally available
    window.awsRum = awsRum as unknown as AwsRum;

    logger.info('CloudWatch RUM initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize CloudWatch RUM', { error });
  }
};
