import { logger } from '@awslambdahackathon/utils/lambda';
import { z } from 'zod';

// Base environment variables schema - Common to ALL Lambda functions
export const BaseLambdaEnvironmentVarsSchema = z.object({
  // AWS Core configuration
  AWS_REGION: z.string().default('us-east-1'),

  // AWS Lambda Powertools configuration (required for all Lambdas)
  POWERTOOLS_SERVICE_NAME: z.string().min(1),
  POWERTOOLS_METRICS_NAMESPACE: z.string().min(1),
  AWS_LAMBDA_FUNCTION_NAME: z.string().min(1),

  // CloudWatch configuration
  CLOUDWATCH_NAMESPACE: z.string().min(1),

  // Logging configuration
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),

  // AWS Lambda context (optional, auto-populated by AWS)
  AWS_LAMBDA_FUNCTION_VERSION: z.string().optional(),
  AWS_LAMBDA_LOG_GROUP_NAME: z.string().optional(),
  AWS_LAMBDA_LOG_STREAM_NAME: z.string().optional(),
});

// Base configuration interface
export interface BaseLambdaConfig {
  aws: {
    region: string;
    functionName: string;
  };
  powertools: {
    serviceName: string;
    metricsNamespace: string;
  };
  cloudwatch: {
    namespace: string;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    nodeEnv: 'development' | 'production' | 'test';
  };
}

// Parse and validate base environment variables
export const parseBaseLambdaEnvironmentVars = (): z.infer<
  typeof BaseLambdaEnvironmentVarsSchema
> => {
  try {
    return BaseLambdaEnvironmentVarsSchema.parse(process.env);
  } catch (error) {
    logger.error(
      'Base Lambda environment variables validation failed:',
      error instanceof Error ? error : String(error)
    );
    throw new Error('Invalid base Lambda environment configuration');
  }
};

// Create base Lambda configuration
export const createBaseLambdaConfig = (): BaseLambdaConfig => {
  const env = parseBaseLambdaEnvironmentVars();

  return {
    aws: {
      region: env.AWS_REGION,
      functionName: env.AWS_LAMBDA_FUNCTION_NAME,
    },
    powertools: {
      serviceName: env.POWERTOOLS_SERVICE_NAME,
      metricsNamespace: env.POWERTOOLS_METRICS_NAMESPACE,
    },
    cloudwatch: {
      namespace: env.CLOUDWATCH_NAMESPACE,
    },
    logging: {
      level: env.LOG_LEVEL,
      nodeEnv: env.NODE_ENV,
    },
  };
};

// Validate base required environment variables
export const validateBaseRequiredEnvironmentVariables = (): void => {
  const requiredEnvVars = [
    'AWS_REGION',
    'POWERTOOLS_SERVICE_NAME',
    'POWERTOOLS_METRICS_NAMESPACE',
    'AWS_LAMBDA_FUNCTION_NAME',
    'CLOUDWATCH_NAMESPACE',
  ];

  const missingEnvVars = requiredEnvVars.filter(
    envVar => !process.env[envVar] || process.env[envVar]!.trim() === ''
  );

  if (missingEnvVars.length > 0) {
    const errorMessage = `Missing required environment variables: ${missingEnvVars.join(', ')}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }
};

// Export environment helpers
export const isDevelopment = () => process.env.NODE_ENV === 'development';
export const isProduction = () => process.env.NODE_ENV === 'production';
export const isTest = () => process.env.NODE_ENV === 'test';

// Export Lambda context helpers
export const getLambdaContext = () => ({
  functionName: process.env.AWS_LAMBDA_FUNCTION_NAME,
  functionVersion: process.env.AWS_LAMBDA_FUNCTION_VERSION,
  logGroupName: process.env.AWS_LAMBDA_LOG_GROUP_NAME,
  logStreamName: process.env.AWS_LAMBDA_LOG_STREAM_NAME,
});
