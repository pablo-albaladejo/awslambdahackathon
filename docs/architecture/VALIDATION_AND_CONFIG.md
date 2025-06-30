# Validation with Zod and Centralized Configuration

This document describes the implementation of robust runtime validation and centralized configuration using **Zod**, with shared schemas for both the frontend (React) and **AWS Lambda** functions. This approach ensures strong type safety, comprehensive runtime validation, and maintainable configuration management across the entire application stack.

## Overview

This document describes the implementation of runtime validation and centralized configuration using Zod, with shared schemas for both the frontend (React) and AWS Lambda functions. The approach ensures type safety, runtime validation, and maintainable configuration management across the entire stack.

## Architecture

### Package Structure

```
packages/
├── types/                    # Shared schemas and types
│   ├── src/
│   │   ├── schemas.ts        # Base schemas (ID, Email, Timestamp, etc.)
│   │   ├── config.ts         # Frontend and lambda configuration schemas
│   │   ├── websocket.ts      # WebSocket message schemas
│   │   ├── auth.ts           # Authentication schemas
│   │   ├── messages.ts       # Chat message schemas
│   │   └── index.ts          # Main exports
│   └── package.json
├── utils/                    # Shared utilities
└── eslint-config/            # ESLint configuration

apps/
├── web/                      # React frontend
│   ├── src/
│   │   ├── config/
│   │   │   └── app-config.ts # Centralized frontend config
│   │   ├── services/
│   │   │   └── validation-service.ts # Validation service
│   │   └── contexts/
│   │       └── WebSocketContext.tsx # Updated context
│   └── package.json
└── runtime/                  # Lambda functions
    ├── src/
    │   ├── config/
    │   │   └── lambda-config.ts # Centralized lambda config
    │   └── entry-points/
    └── package.json
```

## Shared Schemas

### Base Schemas (`packages/types/src/schemas.ts`)

```typescript
export const IdSchema = z.string().min(1);
export const EmailSchema = z.string().email();
export const TimestampSchema = z.string().datetime();
export const UrlSchema = z.string().url();

export const PerformanceMetricSchema = z.object({
  name: z.string().min(1),
  value: z.number(),
  timestamp: TimestampSchema,
  metadata: z.record(z.unknown()).optional(),
});
```

### Configuration (`packages/types/src/config.ts`)

```typescript
export const FrontendConfigSchema = z.object({
  websocket: z.object({
    url: z.string().url(),
    reconnectAttempts: z.number().int().min(1).max(10).default(5),
    reconnectDelay: z.number().int().min(100).max(30000).default(1000),
    maxReconnectDelay: z.number().int().min(1000).max(60000).default(30000),
  }),
  rum: z.object({
    enabled: z.boolean().default(false),
    applicationId: z.string().optional(),
    // ... more config
  }),
  // ... more sections
});

export const LambdaConfigSchema = z.object({
  database: z.object({
    tableName: z.string().min(1),
    region: z.string().default('us-east-1'),
    endpoint: z.string().url().optional(),
  }),
  // ... more config
});
```

### WebSocket (`packages/types/src/websocket.ts`)

```typescript
export const WebSocketMessageTypeSchema = z.enum([
  'auth',
  'auth_response',
  'message',
  'message_response',
  'error',
  'system',
  'ping',
  'pong',
  'connection_status',
]);

export const WebSocketMessageSchema = z.discriminatedUnion('type', [
  BaseWebSocketMessageSchema.extend({
    type: z.literal('auth'),
    data: AuthMessageSchema,
  }),
  // ... more message types
]);

export const createAuthMessage = (token: string): WebSocketMessage => ({
  type: 'auth',
  id: crypto.randomUUID(),
  timestamp: new Date().toISOString(),
  data: {
    action: 'authenticate',
    token,
  },
});
```

### Authentication (`packages/types/src/auth.ts`)

```typescript
export const JWTTokenSchema = z.object({
  sub: IdSchema,
  iss: z.string().min(1),
  aud: z.string().min(1),
  exp: z.number().int(),
  iat: z.number().int(),
  'cognito:groups': z.array(z.string()).optional(),
  // ... more fields
});

export const validateJWTToken = (token: string): JWTToken => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return JWTTokenSchema.parse(payload);
  } catch (error) {
    throw new Error('Invalid JWT token');
  }
};
```

### Messages (`packages/types/src/messages.ts`)

```typescript
export const ChatMessageDataSchema = z.object({
  id: IdSchema,
  text: z.string().min(1).max(10000),
  isUser: z.boolean(),
  timestamp: TimestampSchema,
  sessionId: IdSchema.optional(),
  userId: IdSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const isMessageFromUser = (message: ChatMessageData): boolean =>
  message.isUser;
export const getMessageAge = (message: ChatMessageData): number =>
  Date.now() - new Date(message.timestamp).getTime();
```

## Centralized Configuration

### Frontend (`apps/web/src/config/app-config.ts`)

This file defines the centralized configuration for the React frontend, leveraging shared schemas from `@awslambdahackathon/types` for validation.

```typescript
import {
  FrontendConfigSchema,
  DEFAULT_FRONTEND_CONFIG,
  type FrontendConfig,
} from '@awslambdahackathon/types';

const EnvironmentVarsSchema = z.object({
  VITE_WEBSOCKET_URL: z.string().url().optional(),
  VITE_AWS_RUM_APPLICATION_ID: z.string().optional(),
  VITE_USER_POOL_ID: z.string().min(1),
  // ... more variables
});

const createAppConfig = (): FrontendConfig => {
  const env = parseEnvironmentVars();
  const config: FrontendConfig = {
    websocket: {
      url: env.VITE_WEBSOCKET_URL || DEFAULT_FRONTEND_CONFIG.websocket.url,
      reconnectAttempts: env.VITE_WS_RECONNECT_ATTEMPTS,
      // ... more config
    },
    // ... more sections
  };
  return FrontendConfigSchema.parse(config);
};

export const APP_CONFIG = createAppConfig();
export const getWebSocketConfig = () => APP_CONFIG.websocket;
export const getRumConfig = () => APP_CONFIG.rum;
```

### Lambda (`apps/runtime/src/config/lambda-config.ts`)

This file defines the centralized configuration for the AWS Lambda backend, leveraging shared schemas from `@awslambdahackathon/types` for validation.

```typescript
import {
  LambdaConfigSchema,
  DEFAULT_LAMBDA_CONFIG,
  type LambdaConfig,
} from '@awslambdahackathon/types';

const LambdaEnvironmentVarsSchema = z.object({
  DYNAMODB_TABLE_NAME: z.string().min(1),
  AWS_REGION: z.string().default('us-east-1'),
  WEBSOCKET_ENDPOINT: z.string().url(),
  // ... more variables
});

const createLambdaConfig = (): LambdaConfig => {
  const env = parseLambdaEnvironmentVars();
  const config: LambdaConfig = {
    database: {
      tableName: env.DYNAMODB_TABLE_NAME,
      region: env.AWS_REGION,
      endpoint: env.DYNAMODB_ENDPOINT,
    },
    // ... more sections
  };
  return LambdaConfigSchema.parse(config);
};

export const LAMBDA_CONFIG = createLambdaConfig();
```

## Validation Services

### WebSocket Validation Service (`apps/web/src/services/validation-service.ts`)

```typescript
import {
  validateWebSocketMessage,
  validateAuthMessage,
  validateChatMessage,
  createAuthMessage,
  createChatMessage,
  // ... more imports
} from '@awslambdahackathon/types';

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: unknown;
}

export class WebSocketValidationService {
  static validateMessage(data: unknown): ValidationResult<WebSocketMessage> {
    try {
      const message = validateWebSocketMessage(data);
      return { success: true, data: message };
    } catch (error) {
      return {
        success: false,
        error: 'Invalid message format',
        details: error,
      };
    }
  }

  static validateAuthMessage(data: unknown): ValidationResult<AuthMessage> {
    try {
      const authMessage = validateAuthMessage(data);
      return { success: true, data: authMessage };
    } catch (error) {
      return {
        success: false,
        error: 'Invalid authentication message',
        details: error,
      };
    }
  }

  static validateCompleteMessage(
    message: string,
    sessionId?: string
  ): ValidationResult<WebSocketMessage> {
    const sizeValidation = this.validateMessageSize(message);
    if (!sizeValidation.success) {
      return {
        success: false,
        error: sizeValidation.error,
        details: sizeValidation.details,
      };
    }
    const contentValidation = this.validateMessageContent(message);
    if (!contentValidation.success) {
      return {
        success: false,
        error: contentValidation.error,
        details: contentValidation.details,
      };
    }
    try {
      const chatMessage = this.createChatMessage(message, sessionId);
      return { success: true, data: chatMessage };
    } catch (error) {
      return {
        success: false,
        error: 'Failed to create message',
        details: error,
      };
    }
  }

  static validateMessageSize(
    message: string,
    maxSize: number = 10000
  ): ValidationResult<string> {
    if (message.length > maxSize) {
      return {
        success: false,
        error: `Message too large. Maximum size is ${maxSize} characters.`,
        details: { size: message.length, maxSize },
      };
    }
    return { success: true, data: message };
  }

  static validateMessageContent(message: string): ValidationResult<string> {
    if (!message.trim()) {
      return { success: false, error: 'Message cannot be empty' };
    }
    if (
      message.length > 1000 &&
      message.replace(/\s/g, '').length < message.length * 0.1
    ) {
      return { success: false, error: 'Message contains too much whitespace' };
    }
    const repeatedCharRegex = /(.)\1{10,}/;
    if (repeatedCharRegex.test(message)) {
      return {
        success: false,
        error: 'Message contains too many repeated characters',
      };
    }
    return { success: true, data: message };
  }
}

export class ValidationUtils {
  static validateRequired<T extends Record<string, unknown>>(
    data: T,
    requiredFields: (keyof T)[]
  ): ValidationResult<T> {
    const missingFields: string[] = [];
    for (const field of requiredFields) {
      if (
        data[field] === undefined ||
        data[field] === null ||
        data[field] === ''
      ) {
        missingFields.push(String(field));
      }
    }
    if (missingFields.length > 0) {
      return {
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`,
        details: { missingFields },
      };
    }
    return { success: true, data };
  }

  static validateStringLength(
    value: string,
    minLength: number,
    maxLength: number,
    fieldName: string = 'value'
  ): ValidationResult<string> {
    if (value.length < minLength) {
      return {
        success: false,
        error: `${fieldName} must be at least ${minLength} characters long`,
        details: { length: value.length, minLength },
      };
    }
    if (value.length > maxLength) {
      return {
        success: false,
        error: `${fieldName} must be no more than ${maxLength} characters long`,
        details: { length: value.length, maxLength },
      };
    }
    return { success: true, data: value };
  }

  static validateEmail(email: string): ValidationResult<string> {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return {
        success: false,
        error: 'Invalid email format',
        details: { email },
      };
    }
    return { success: true, data: email };
  }

  static validateUrl(url: string): ValidationResult<string> {
    try {
      new URL(url);
      return { success: true, data: url };
    } catch {
      return { success: false, error: 'Invalid URL format', details: { url } };
    }
  }

  static validateNumericRange(
    value: number,
    min: number,
    max: number,
    fieldName: string = 'value'
  ): ValidationResult<number> {
    if (value < min || value > max) {
      return {
        success: false,
        error: `${fieldName} must be between ${min} and ${max}`,
        details: { value, min, max },
      };
    }
    return { success: true, data: value };
  }
}
```

## Usage in the Frontend

### WebSocketContext Example

```typescript
import { webSocketValidation } from '../services/validation-service';
import { getWebSocketConfig } from '../config/app-config';

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
}) => {
  const websocketConfig = getWebSocketConfig();

  const sendMessage = useCallback(
    async (text: string) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        const error = 'WebSocket is not connected';
        setState(prev => ({ ...prev, error }));
        throw new Error(error);
      }
      const validation = webSocketValidation.validateCompleteMessage(
        text,
        state.sessionId
      );
      if (!validation.success) {
        const errorMessage = validation.error || 'Message validation failed';
        setState(prev => ({ ...prev, error: errorMessage }));
        throw new Error(errorMessage);
      }
      try {
        ws.send(JSON.stringify(validation.data));
        setState(prev => ({
          ...prev,
          messages: [
            ...prev.messages,
            {
              id: Date.now().toString(),
              text,
              isUser: true,
              timestamp: new Date(),
              sessionId: state.sessionId,
            },
          ],
          isLoading: true,
          error: undefined,
        }));
      } catch (error) {
        const errorMessage = 'Failed to send message';
        setState(prev => ({ ...prev, error: errorMessage }));
        throw new Error(errorMessage);
      }
    },
    [ws, state.sessionId]
  );

  const handleMessage = useCallback((event: MessageEvent<string>) => {
    try {
      const validation = webSocketValidation.validateMessage(
        JSON.parse(event.data)
      );
      if (!validation.success || !validation.data) {
        logger.error('Invalid message received:', validation.error);
        return;
      }
      const data = validation.data;
      logger.info('Message received', { data });
      if (data.type === 'auth_response') {
        if (data.data.success) {
          setState(prev => ({
            ...prev,
            isConnected: true,
            error: undefined,
            messages: [
              ...prev.messages,
              {
                id: Date.now().toString(),
                text: 'Connected to chatbot',
                isUser: false,
                timestamp: new Date(),
              },
            ],
          }));
          logger.info('WebSocket authentication successful');
        } else {
          const errorMessage =
            data.data.error || 'Authentication failed. Please log in again.';
          handleError(errorMessage);
          newWs.close();
        }
        return;
      }
      // ... handle other message types
    } catch (error) {
      logger.error('Error parsing WebSocket message', {
        error,
        data: event.data,
      });
      handleError('Failed to parse server message');
    }
  }, []);
  // ... rest of the context
};
```

## Usage in AWS Lambda Functions

### Example Handler with Validation

AWS Lambda functions utilize the shared schemas and validation utilities to ensure incoming event data and internal configurations are valid.

```typescript
import {
  validateWebSocketMessage,
  validateAuthMessage,
  validateChatMessage,
  createErrorMessage,
  type WebSocketMessage,
} from '@awslambdahackathon/types';
import { getWebSocketConfig, getAuthConfig } from '../config/lambda-config';

export const handleWebSocketMessage = async (event: APIGatewayProxyEvent) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const validation = validateWebSocketMessage(body);
    const message = validation;
    const websocketConfig = getWebSocketConfig();
    const authConfig = getAuthConfig();
    switch (message.type) {
      case 'auth':
        return await handleAuthMessage(message, authConfig);
      case 'message':
        return await handleChatMessage(message, websocketConfig);
      case 'ping':
        return await handlePingMessage(message);
      default:
        return {
          statusCode: 400,
          body: JSON.stringify(
            createErrorMessage(
              new Error('Unknown message type'),
              'UNKNOWN_MESSAGE_TYPE'
            )
          ),
        };
    }
  } catch (error) {
    logger.error('Error handling WebSocket message:', error);
    return {
      statusCode: 500,
      body: JSON.stringify(
        createErrorMessage(
          error instanceof Error ? error : new Error('Unknown error'),
          'INTERNAL_ERROR'
        )
      ),
    };
  }
};

const handleAuthMessage = async (
  message: WebSocketMessage,
  authConfig: any
) => {
  try {
    const token = message.data.token;
    const decodedToken = validateJWTToken(token);
    if (isTokenExpired(decodedToken)) {
      return {
        statusCode: 401,
        body: JSON.stringify(
          createErrorMessage(new Error('Token expired'), 'TOKEN_EXPIRED')
        ),
      };
    }
    // ... authentication logic
    return {
      statusCode: 200,
      body: JSON.stringify({
        type: 'auth_response',
        data: {
          success: true,
          userId: decodedToken.sub,
          sessionId: generateSessionId(),
        },
      }),
    };
  } catch (error) {
    return {
      statusCode: 401,
      body: JSON.stringify(
        createErrorMessage(
          error instanceof Error ? error : new Error('Authentication failed'),
          'AUTH_FAILED'
        )
      ),
    };
  }
};
```

## Environment Variables

### Frontend (.env)

```bash
VITE_WEBSOCKET_URL=wss://your-api-gateway-url.execute-api.region.amazonaws.com/stage
VITE_AWS_RUM_APPLICATION_ID=your-rum-application-id
VITE_AWS_RUM_GUEST_ROLE_ARN=arn:aws:iam::account:role/your-guest-role
VITE_AWS_RUM_IDENTITY_POOL_ID=region:identity-pool-id
VITE_APP_VERSION=1.0.0
VITE_AWS_REGION=us-east-1
VITE_USER_POOL_ID=region_user-pool-id
VITE_USER_POOL_CLIENT_ID=your-user-pool-client-id
VITE_IDENTITY_POOL_ID=region:identity-pool-id
VITE_API_BASE_URL=https://your-api-gateway-url.execute-api.region.amazonaws.com/stage
VITE_API_TIMEOUT=10000
VITE_API_RETRY_ATTEMPTS=3
VITE_SLOW_RENDER_THRESHOLD=16
VITE_MEMORY_WARNING_THRESHOLD=0.8
VITE_LONG_TASK_THRESHOLD=50
VITE_LAYOUT_SHIFT_THRESHOLD=0.1
VITE_WS_RECONNECT_ATTEMPTS=5
VITE_WS_RECONNECT_DELAY=1000
VITE_WS_MAX_RECONNECT_DELAY=30000
NODE_ENV=development
VITE_DEBUG=false
```

### Lambda (Environment Variables)

```bash
DYNAMODB_TABLE_NAME=your-dynamodb-table-name
AWS_REGION=us-east-1
DYNAMODB_ENDPOINT=http://localhost:8000
WEBSOCKET_ENDPOINT=https://your-api-gateway-url.execute-api.region.amazonaws.com/stage
WEBSOCKET_STAGE=$default
WEBSOCKET_CONNECTION_TIMEOUT=10000
USER_POOL_ID=region_user-pool-id
USER_POOL_CLIENT_ID=your-user-pool-client-id
COGNITO_REGION=us-east-1
LOG_LEVEL=info
ENABLE_STRUCTURED_LOGGING=true
ENABLE_REQUEST_LOGGING=true
RATE_LIMIT_ENABLED=true
MAX_REQUESTS_PER_MINUTE=100
MAX_CONNECTIONS_PER_USER=3
NODE_ENV=production
AWS_LAMBDA_FUNCTION_NAME=your-function-name
AWS_LAMBDA_FUNCTION_VERSION=$LATEST
```

## Migration Guide

### Steps to Migrate Existing Code

1. **Install dependencies:**
   ```bash
   cd packages/types && npm install
   cd ../../apps/web && npm install
   cd ../runtime && npm install
   ```
2. **Update imports:**
   ```typescript
   // Before
   import { Message } from '../types/message';
   // After
   import { ChatMessageData } from '@awslambdahackathon/types';
   ```
3. **Replace manual validation:**
   ```typescript
   // Before
   if (!message || message.length > 1000) {
     throw new Error('Invalid message');
   }
   // After
   const validation = webSocketValidation.validateCompleteMessage(message);
   if (!validation.success) {
     throw new Error(validation.error);
   }
   ```
4. **Use centralized config:**
   ```typescript
   // Before
   const wsUrl = process.env.VITE_WEBSOCKET_URL || 'wss://localhost:3001';
   // After
   const { url } = getWebSocketConfig();
   ```

## Benefits

- **Type Safety:** All data is strongly typed with TypeScript.
- **Runtime Validation:** Zod schemas validate all critical data at runtime.
- **Shared Schemas:** Both frontend and lambda use the same validation logic.
- **Centralized Config:** All configuration is validated and type-safe.
- **Consistent Error Handling:** Unified error handling for validation and config.
- **Performance:** Efficient validation with minimal overhead.
- **Maintainability:** Code is easier to maintain and extend.
- **Security:** Robust input validation reduces attack surface.

## Next Steps

- Implement global state management (e.g., Zustand) for the frontend.
- Add comprehensive unit and integration tests.
- Integrate CI/CD pipelines for linting, type checking, and automated testing.
