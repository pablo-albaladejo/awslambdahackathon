// CloudWatch RUM Configuration
// This file contains the configuration for AWS CloudWatch RUM
// which provides real-time monitoring of frontend applications

import { AwsRum, logger } from '@awslambdahackathon/utils/frontend';

export interface RUMConfig {
  sessionSampleRate: number;
  identityPoolId: string;
  endpoint: string;
  telemetries: ('performance' | 'errors' | 'http')[];
  allowCookies: boolean;
  enableXRay: boolean;
}

export const initializeRUM = async () => {
  // Only initialize RUM in production environments
  if (typeof window === 'undefined' || !import.meta.env.PROD) {
    return;
  }

  try {
    const configResponse = await fetch('/rum-config.json');
    if (!configResponse.ok) {
      throw new Error(
        `Failed to fetch RUM config: ${configResponse.statusText}`
      );
    }
    const remoteConfig = await configResponse.json();

    const { applicationId, identityPoolId, region } = remoteConfig;
    const application_version = '1.0.0';

    if (!applicationId || !identityPoolId || !region) {
      logger.warn('RUM config from server is missing required fields', {
        remoteConfig,
      });
      return;
    }

    const rumConfig: RUMConfig = {
      sessionSampleRate: 1,
      identityPoolId: identityPoolId,
      endpoint: `https://dataplane.rum.${region}.amazonaws.com`,
      telemetries: ['performance', 'errors', 'http'],
      allowCookies: true,
      enableXRay: true,
    };

    const { AwsRum: RumClient } = await import('aws-rum-web');
    const awsRum = new RumClient(
      applicationId,
      application_version,
      region,
      rumConfig
    );

    // Make it globally available
    window.awsRum = awsRum as unknown as AwsRum;

    logger.info('CloudWatch RUM initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize CloudWatch RUM', { error });
  }
};
