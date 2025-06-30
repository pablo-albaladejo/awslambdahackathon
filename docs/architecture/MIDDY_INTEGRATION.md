# Middy Integration

This document describes the integration of the Middy middleware framework within the AWS Lambda functions of the real-time communication project. Middy helps streamline handler logic, reduce boilerplate, and enforce consistent patterns for logging, validation, and error handling.

## Overview

Middy is a popular middleware framework for AWS Lambda that provides useful middleware for common tasks like input validation, error handling, CORS, and logging. We've integrated Middy into our WebSocket handlers to improve code organization, reduce boilerplate, and add consistent error handling and logging.

## Features Added

### 1. WebSocket-Specific Handler Factory

We've created a `createWebSocketHandler` function (available from `@awslambdahackathon/utils/lambda`) that wraps AWS Lambda handlers with WebSocket-specific middleware:

```typescript
import {
  createWebSocketHandler,
  commonSchemas,
} from '@awslambdahackathon/utils/lambda';

const myHandler = async (event: APIGatewayProxyEvent, context?: any) => {
  // Your handler logic here
};

export const handler = createWebSocketHandler(
  myHandler,
  commonSchemas.websocketMessage
);
```

### 2. WebSocket-Specific Middleware

#### WebSocket Logger (`websocketLogger`)

- Logs WebSocket events with connection-specific information
- Includes event type, connection ID, route key, and message ID
- Provides structured logging for WebSocket operations

#### WebSocket Message Validator (`websocketMessageValidator`)

- Validates WebSocket message format using Zod schemas
- Parses JSON and validates message structure
- Provides parsed body to handlers for easier access

#### Error Handler (`httpErrorHandler`)

- Standard Middy error handling middleware
- Converts errors to proper HTTP responses
- Provides consistent error handling across all handlers

### 3. Validation Schemas

We've added WebSocket-specific Zod validation schemas:

#### `websocketConnection`

Validates WebSocket connection/disconnection events:

```typescript
{
  httpMethod: string,
  path: string,
  headers: Record<string, string>,
  requestContext: {
    requestId: string,
    connectionId: string,
    eventType: 'CONNECT' | 'DISCONNECT',
    routeKey?: string,
    messageId?: string,
    apiId: string,
    stage: string,
  }
}
```

#### `websocketMessage`

Validates WebSocket message events:

```typescript
{
  httpMethod: string,
  path: string,
  headers: Record<string, string>,
  body?: string,
  requestContext: {
    requestId: string,
    connectionId: string,
    eventType: 'MESSAGE',
    routeKey: string,
    messageId: string,
    apiId: string,
    stage: string,
  }
}
```

#### `websocketMessageBody`

Validates the structure of WebSocket message bodies:

```typescript
{
  type: 'auth' | 'message' | 'ping',
  data: {
    action: string,
    message?: string,
    sessionId?: string,
    token?: string,
  }
}
```

## Usage Examples

### Connection Handler

```typescript
import {
  createWebSocketHandler,
  commonSchemas,
} from '@awslambdahackathon/utils/lambda';

const connectionHandler = async (event: APIGatewayProxyEvent) => {
  const connectionId = event.requestContext.connectionId;

  if (event.requestContext.eventType === 'CONNECT') {
    // Handle connection
    return { statusCode: 200, body: '' };
  }

  if (event.requestContext.eventType === 'DISCONNECT') {
    // Handle disconnection
    return { statusCode: 200, body: '' };
  }
};

export const handler = createWebSocketHandler(
  connectionHandler,
  commonSchemas.websocketConnection
);
```

### Conversation Handler

```typescript
import {
  createWebSocketHandler,
  commonSchemas,
} from '@awslambdahackathon/utils/lambda';

const conversationHandler = async (
  event: APIGatewayProxyEvent,
  context?: any
) => {
  // Use parsed body from middleware if available
  const websocketMessage = context?.parsedBody || JSON.parse(event.body);

  const { type, data } = websocketMessage;

  switch (type) {
    case 'auth':
      // Handle authentication
      break;
    case 'message':
      // Handle chat message
      break;
    case 'ping':
      // Handle ping
      break;
  }
};

export const handler = createWebSocketHandler(
  conversationHandler,
  commonSchemas.websocketMessage
);
```

## Benefits

1. **Consistent Logging**: All WebSocket events are logged with consistent structure
2. **Input Validation**: Automatic validation of WebSocket events and message bodies
3. **Error Handling**: Centralized error handling with proper HTTP responses
4. **Code Reuse**: Middleware can be shared across multiple handlers
5. **Type Safety**: Zod schemas provide runtime type validation
6. **Reduced Boilerplate**: Less repetitive code in individual handlers

## Dependencies

The following Middy packages are used:

- `@middy/core`: Core Middy functionality
- `@middy/http-error-handler`: Error handling middleware
- `@middy/validator`: Input validation middleware
- `@middy/http-json-body-parser`: JSON body parsing (for REST APIs)
- `@middy/http-cors`: CORS handling (for REST APIs)

## Configuration

The middleware is configured in `packages/utils/src/lambda.ts` and can be customized by modifying the middleware arrays in the handler factory functions.

## Testing

When testing handlers with Middy, you can test the raw handler function directly or test the wrapped handler with the full middleware stack. The middleware will automatically handle logging, validation, and error responses.
