# @awslambdahackathon/types

This package provides shared TypeScript types and Zod schemas, ensuring robust type safety and consistency across the entire AWS Lambda Hackathon project's application stack (frontend and backend).

## Overview

This package contains:

- **Client-side types**: Used by the web frontend for WebSocket communication
- **Server-side types**: Used by the runtime backend for processing WebSocket events
- **API Gateway types**: Used by the backend for handling AWS API Gateway WebSocket events
- **Validation schemas**: Zod schemas for runtime validation
- **Factory functions**: Helper functions for creating type-safe messages

## WebSocket Type Architecture

### Client-Side Types (Frontend)

These types are used by the web frontend (`apps/web`) for WebSocket communication:

```typescript
import {
  WebSocketMessage,
  WebSocketMessageType,
  AuthMessage,
  AuthResponse,
  ChatMessage,
  ChatMessageResponse,
  createAuthMessage,
  createChatMessage,
  validateWebSocketMessage,
} from '@awslambdahackathon/types';

// Create a typed auth message
const authMsg = createAuthMessage(token);

// Create a typed chat message
const chatMsg = createChatMessage('Hello', sessionId);

// Validate incoming messages
const validatedMsg = validateWebSocketMessage(rawData);
```

#### Core Client Types

- `WebSocketMessage`: Union type for all WebSocket messages
- `WebSocketMessageType`: Enum of message types ('auth', 'message', 'ping', etc.)
- `AuthMessage`: Authentication request structure
- `AuthResponse`: Authentication response structure
- `ChatMessage`: Chat message request structure
- `ChatMessageResponse`: Chat message response structure
- `ConnectionStatus`: Connection status information
- `WebSocketConnection`: Connection metadata

### Server-Side Types (Backend)

These types are used by the runtime backend (`apps/runtime`) for processing WebSocket events:

```typescript
import {
  WebSocketEventDto,
  WebSocketConnectionEventDto,
  WebSocketAuthEventDto,
  WebSocketMessageEventDto,
  WebSocketErrorEventDto,
  APIGatewayWebSocketEventDto,
  APIGatewayWebSocketResponseDto,
} from '@awslambdahackathon/types';

// Process connection events
function handleConnection(event: WebSocketConnectionEventDto) {
  // Handle connection/disconnection
}

// Process auth events
function handleAuth(event: WebSocketAuthEventDto) {
  // Handle authentication
}

// Process API Gateway events
function handleAPIGatewayEvent(event: APIGatewayWebSocketEventDto) {
  // Handle raw API Gateway WebSocket events
}
```

#### Core Server Types

- `WebSocketEventDto`: Base event structure
- `WebSocketConnectionEventDto`: Connection/disconnection events
- `WebSocketAuthEventDto`: Authentication events
- `WebSocketMessageEventDto`: Message events
- `WebSocketPingEventDto`: Ping/pong events
- `WebSocketErrorEventDto`: Error events
- `WebSocketCustomEventDto`: Custom events
- `WebSocketEventUnionDto`: Union of all event types

### API Gateway Types

These types handle AWS API Gateway WebSocket integration:

```typescript
import {
  APIGatewayWebSocketEventDto,
  APIGatewayWebSocketResponseDto,
  APIGatewayWebSocketMessageDto,
  APIGatewayWebSocketConnectionDto,
  validateAPIGatewayEvent,
} from '@awslambdahackathon/types';

// Lambda handler
export const handler = async (event: APIGatewayWebSocketEventDto) => {
  const validatedEvent = validateAPIGatewayEvent(event);

  const response: APIGatewayWebSocketResponseDto = {
    statusCode: 200,
    body: JSON.stringify({ success: true }),
  };

  return response;
};
```

#### Core API Gateway Types

- `APIGatewayWebSocketEventDto`: Raw API Gateway event structure
- `APIGatewayWebSocketResponseDto`: API Gateway response structure
- `APIGatewayWebSocketMessageDto`: Parsed message structure
- `APIGatewayWebSocketConnectionDto`: Connection information
- `APIGatewayWebSocketErrorDto`: Error response structure

## Message Flow

### Frontend to Backend

1. **Frontend** creates message using factory functions:

   ```typescript
   const message = createChatMessage('Hello world', sessionId);
   ```

2. **WebSocket** sends JSON serialized message:

   ```json
   {
     "type": "message",
     "id": "uuid",
     "timestamp": "2024-01-01T00:00:00Z",
     "data": {
       "action": "sendMessage",
       "message": "Hello world",
       "sessionId": "session-123"
     }
   }
   ```

3. **API Gateway** wraps in APIGatewayWebSocketEventDto:

   ```typescript
   {
     requestContext: {
       connectionId: "abc123",
       eventType: "MESSAGE",
       // ... other context
     },
     body: "{\\"type\\":\\"message\\",\\"data\\":{...}}"
   }
   ```

4. **Runtime** processes using mappers:

   ```typescript
   // API Gateway Event -> Domain Message
   const connectionInfo = apiGatewayMapper.mapEventToConnectionInfo(event);
   const messageDto = apiGatewayMapper.mapMessageBodyToDto(
     parsedBody,
     requestId
   );

   // Domain processing...

   // Domain -> WebSocket Event
   const wsEvent = webSocketMapper.mapMessageToEvent(message, connectionId);
   ```

### Backend to Frontend

1. **Backend** creates WebSocket event:

   ```typescript
   const event = webSocketMapper.mapMessageToEvent(message, connectionId);
   ```

2. **WebSocket Service** sends to client:

   ```json
   {
     "type": "message_response",
     "timestamp": "2024-01-01T00:00:00Z",
     "data": {
       "messageId": "msg-123",
       "content": "Response message",
       "timestamp": "2024-01-01T00:00:00Z"
     }
   }
   ```

3. **Frontend** validates and processes:
   ```typescript
   const validatedMessage = validateWebSocketMessage(event.data);
   // Update UI state
   ```

## Validation

All types include Zod schemas for runtime validation:

```typescript
import {
  WebSocketMessageSchema,
  APIGatewayWebSocketEventDtoSchema,
  validateWebSocketMessage,
  validateAPIGatewayEvent,
} from '@awslambdahackathon/types';

// Validate with schema directly
const result = WebSocketMessageSchema.safeParse(data);

// Or use helper functions
try {
  const validMessage = validateWebSocketMessage(data);
  // Process valid message
} catch (error) {
  // Handle validation error
}
```

## Factory Functions

Type-safe factory functions for creating messages:

```typescript
import {
  createAuthMessage,
  createChatMessage,
  createPingMessage,
  createErrorMessage,
} from '@awslambdahackathon/types';

// Create messages with proper typing
const auth = createAuthMessage(token);
const chat = createChatMessage('Hello', sessionId);
const ping = createPingMessage();
const error = createErrorMessage(new Error('Something went wrong'));
```

## Usage Examples

### Frontend WebSocket Client

```typescript
import {
  WebSocketMessage,
  createAuthMessage,
  createChatMessage,
  validateWebSocketMessage,
} from '@awslambdahackathon/types';

class WebSocketClient {
  private ws: WebSocket;

  authenticate(token: string) {
    const message = createAuthMessage(token);
    this.ws.send(JSON.stringify(message));
  }

  sendMessage(text: string, sessionId?: string) {
    const message = createChatMessage(text, sessionId);
    this.ws.send(JSON.stringify(message));
  }

  onMessage(event: MessageEvent) {
    try {
      const message = validateWebSocketMessage(JSON.parse(event.data));
      this.handleMessage(message);
    } catch (error) {
      console.error('Invalid message received:', error);
    }
  }
}
```

### Backend Lambda Handler

```typescript
import {
  APIGatewayWebSocketEventDto,
  APIGatewayWebSocketResponseDto,
  validateAPIGatewayEvent,
  WebSocketEventDto,
} from '@awslambdahackathon/types';

export const handler = async (
  event: APIGatewayWebSocketEventDto
): Promise<APIGatewayWebSocketResponseDto> => {
  try {
    const validatedEvent = validateAPIGatewayEvent(event);

    // Process event using mappers
    const result = await processWebSocketEvent(validatedEvent);

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
```

### Backend Event Processing

```typescript
import {
  WebSocketEventUnionDto,
  WebSocketConnectionEventDto,
  WebSocketAuthEventDto,
  WebSocketMessageEventDto,
} from '@awslambdahackathon/types';

function processWebSocketEvent(event: WebSocketEventUnionDto) {
  switch (event.type) {
    case 'connection':
      return handleConnection(event as WebSocketConnectionEventDto);
    case 'auth_success':
    case 'auth_failure':
      return handleAuth(event as WebSocketAuthEventDto);
    case 'message':
      return handleMessage(event as WebSocketMessageEventDto);
    default:
      throw new Error(`Unknown event type: ${event.type}`);
  }
}
```

## Type Safety Benefits

1. **Compile-time validation**: TypeScript catches type mismatches
2. **Runtime validation**: Zod schemas validate data at runtime
3. **Consistent contracts**: Same types used across frontend and backend
4. **Auto-completion**: Full IDE support with type hints
5. **Refactoring safety**: Changes propagate across the entire codebase

## Migration from Local Types

If you're migrating from local type definitions:

1. Replace local imports:

   ```typescript
   // Before
   import { Message } from './local-types';

   // After
   import { ChatMessageData } from '@awslambdahackathon/types';
   ```

2. Update message creation:

   ```typescript
   // Before
   const message = { type: 'auth', data: { token } };

   // After
   const message = createAuthMessage(token);
   ```

3. Add validation:

   ```typescript
   // Before
   const message = JSON.parse(event.data);

   // After
   const message = validateWebSocketMessage(JSON.parse(event.data));
   ```

## Development

To build the types package:

```bash
cd packages/types
npm run build
```

To use in development with watch mode:

```bash
npm run dev
```

## Contributing

When adding new types:

1. Add the Zod schema first
2. Export the TypeScript type using `z.infer`
3. Add validation functions if needed
4. Add factory functions for complex types
5. Update this README with examples
6. Ensure both frontend and backend can use the types

## Architecture Decisions

- **Zod for validation**: Provides both compile-time and runtime type safety
- **Factory functions**: Ensure consistent message creation
- **Discriminated unions**: Enable type-safe event processing
- **Separate client/server types**: Clear separation of concerns
- **Type safety**: Complete compile-time and runtime validation
