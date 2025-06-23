// CloudWatch RUM Configuration
// This file contains the configuration for AWS CloudWatch RUM
// which provides real-time monitoring of frontend applications

import { AwsRum, logger } from '@awslambdahackathon/utils/frontend';
import { type AwsRum as AwsRumClient } from 'aws-rum-web';

export const initializeRUM = async () => {
  if (typeof window === 'undefined') {
    logger.info('Skipping RUM initialization in server environment');
    return;
  }

  try {
    const applicationId = import.meta.env.VITE_RUM_APP_MONITOR_ID;
    const identityPoolId = import.meta.env.VITE_RUM_IDENTITY_POOL_ID;
    const applicationRegion = import.meta.env.VITE_AWS_REGION;

    if (!applicationId || !identityPoolId || !applicationRegion) {
      logger.warn(
        'RUM configuration is missing required environment variables, skipping RUM initialization'
      );
      return;
    }

    logger.info('Initializing RUM with config:', {
      applicationId,
      identityPoolId,
      applicationRegion,
    });

    const config = {
      identityPoolId,
      sessionSampleRate: 1,
      endpoint: `https://dataplane.rum.${applicationRegion}.amazonaws.com`,
      telemetries: ['errors', 'performance', 'http'],
      allowCookies: true,
      enableXRay: true,
    };

    const { AwsRum: AwsRumSdk } = await import('aws-rum-web');
    const awsRum: AwsRumClient = new AwsRumSdk(
      applicationId,
      '1.0.0', // applicationVersion
      applicationRegion,
      config
    );

    window.awsRum = awsRum as unknown as AwsRum;
    logger.info('CloudWatch RUM initialized successfully');
  } catch (error) {
    // Don't throw the error, just log it and continue without RUM
    logger.warn(
      'Failed to initialize CloudWatch RUM, continuing without monitoring',
      { error }
    );

    // Ensure window.awsRum is not undefined to prevent other errors
    window.awsRum = {
      recordPageView: () => {},
      recordError: () => {},
      recordEvent: () => {},
    } as unknown as AwsRum;
  }
};
