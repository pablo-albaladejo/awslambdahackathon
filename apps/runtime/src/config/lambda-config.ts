/**
 * @deprecated This file has been split into modular configurations.
 *
 * Please use one of the following instead:
 *
 * For WebSocket/Connection Lambdas:
 * ```ts
 * import { validateWebSocketRequiredEnvironmentVariables, WEBSOCKET_LAMBDA_CONFIG } from './websocket-lambda-config';
 * ```
 *
 * For REST API Lambdas:
 * ```ts
 * import { validateRestRequiredEnvironmentVariables, REST_LAMBDA_CONFIG } from './rest-lambda-config';
 * ```
 *
 * For automatic detection:
 * ```ts
 * import { validateLambdaEnvironmentForFunction, getLambdaConfigForFunction } from './index';
 * ```
 *
 * Migration guide:
 * - Replace `LAMBDA_CONFIG` with `WEBSOCKET_LAMBDA_CONFIG` or `REST_LAMBDA_CONFIG`
 * - Replace `validateLambdaConfig()` with appropriate validation function
 * - Update imports to use specific configuration modules
 */

// Re-export for backward compatibility (will be removed in future versions)
export {
  getWebSocketAuthConfig as getAuthConfig,
  getWebSocketDatabaseConfig as getDatabaseConfig,
  getWebSocketConfig as getWebSocketConfig,
  isLocalDevelopment,
  WEBSOCKET_LAMBDA_CONFIG as LAMBDA_CONFIG,
  validateWebSocketRequiredEnvironmentVariables as validateLambdaConfig,
} from './websocket-lambda-config';

export {
  getLambdaContext,
  isDevelopment,
  isProduction,
  isTest,
} from './base-lambda-config';

// Type alias for backward compatibility
export type { WebSocketLambdaConfig as LambdaAppConfig } from './websocket-lambda-config';
