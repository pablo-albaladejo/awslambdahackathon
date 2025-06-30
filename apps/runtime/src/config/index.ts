// Base configuration - required for ALL Lambda functions
export * from './base-lambda-config';

// Specific configurations - choose the one that matches your Lambda function's purpose
export * from './rest-lambda-config';
export * from './websocket-lambda-config';

// Legacy container for WebSocket Lambdas
export { container } from './container';

// Configuration factory - automatically detects the appropriate configuration based on environment
export const getLambdaConfigForFunction = () => {
  const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME || '';

  // Auto-detect based on function name patterns
  if (
    functionName.includes('websocket') ||
    functionName.includes('connection') ||
    functionName.includes('conversation')
  ) {
    return require('./websocket-lambda-config');
  }

  if (
    functionName.includes('rest') ||
    functionName.includes('api') ||
    functionName.includes('http')
  ) {
    return require('./rest-lambda-config');
  }

  // Check for WebSocket-specific environment variables
  const hasWebSocketVars = !!(
    process.env.WEBSOCKET_ENDPOINT &&
    process.env.WEBSOCKET_CONNECTIONS_TABLE &&
    process.env.WEBSOCKET_MESSAGES_TABLE
  );

  if (hasWebSocketVars) {
    return require('./websocket-lambda-config');
  }

  // Default to REST configuration for maximum compatibility
  return require('./rest-lambda-config');
};

// Validation factory - validates only the required variables for the detected Lambda type
export const validateLambdaEnvironmentForFunction = () => {
  const config = getLambdaConfigForFunction();

  if (config.validateWebSocketRequiredEnvironmentVariables) {
    config.validateWebSocketRequiredEnvironmentVariables();
  } else if (config.validateRestRequiredEnvironmentVariables) {
    config.validateRestRequiredEnvironmentVariables();
  } else {
    // Fallback to base validation
    const {
      validateBaseRequiredEnvironmentVariables,
    } = require('./base-lambda-config');
    validateBaseRequiredEnvironmentVariables();
  }
};

// Helper to determine Lambda function type
export const getLambdaFunctionType = (): 'websocket' | 'rest' | 'unknown' => {
  const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME || '';

  if (
    functionName.includes('websocket') ||
    functionName.includes('connection') ||
    functionName.includes('conversation')
  ) {
    return 'websocket';
  }

  if (
    functionName.includes('rest') ||
    functionName.includes('api') ||
    functionName.includes('http')
  ) {
    return 'rest';
  }

  // Check for WebSocket-specific environment variables
  const hasWebSocketVars = !!(
    process.env.WEBSOCKET_ENDPOINT &&
    process.env.WEBSOCKET_CONNECTIONS_TABLE &&
    process.env.WEBSOCKET_MESSAGES_TABLE
  );

  if (hasWebSocketVars) {
    return 'websocket';
  }

  return 'unknown';
};
