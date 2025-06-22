# Utils Package

This package provides utilities for both frontend and backend applications with environment-specific exports.

## Usage

### General Utilities (Both Environments)

```typescript
import {
  isValidEmail,
  capitalize,
  generateId,
  z,
} from '@awslambdahackathon/utils';
```

### Frontend-Specific Utilities

```typescript
import { logger } from '@awslambdahackathon/utils/frontend';
```

**Features:**

- CloudWatch RUM integration
- Automatic fallback to console logging
- Type-safe window interface extensions

### Backend-Specific Utilities (Lambda)

```typescript
import {
  createHandler,
  createSuccessResponse,
  logger,
  tracer,
  metrics,
  commonSchemas,
} from '@awslambdahackathon/utils/backend';
```

**Features:**

- Lambda Powertools integration
- Middy middleware factory
- HTTP response utilities
- Zod validation schemas

## Available Exports

### Main Export (`@awslambdahackathon/utils`)

- `isValidEmail` - Email validation utility
- `isValidUUID` - UUID validation utility
- `capitalize` - String capitalization utility
- `generateId` - ID generation utility
- `z` - Zod schema builder
- `ZodSchema` - Zod schema type
- `logger` - Environment-aware logger (frontend/backend)

### Frontend Export (`@awslambdahackathon/utils/frontend`)

- `logger` - Frontend logger with CloudWatch RUM support
- `z` - Zod utilities
- `ZodSchema` - Zod schema type

### Backend Export (`@awslambdahackathon/utils/backend`)

- `createHandler` - Middy middleware factory
- `createSuccessResponse` - HTTP success response utility
- `createErrorResponse` - HTTP error response utility
- `logger` - Lambda Powertools logger
- `tracer` - Lambda Powertools tracer
- `metrics` - Lambda Powertools metrics
- `commonSchemas` - Common Zod validation schemas
- `Logger` - Lambda Powertools Logger class
- `Tracer` - Lambda Powertools Tracer class
- `Metrics` - Lambda Powertools Metrics class
- `middy` - Middy core
- `cors` - Middy CORS middleware
- `httpErrorHandler` - Middy error handler
- `httpJsonBodyParser` - Middy JSON body parser
- `validator` - Middy validator middleware
- `requestResponseLogger` - Custom request/response logger

## Examples

### Frontend Usage

```typescript
import { logger } from '@awslambdahackathon/utils/frontend';

// This will use CloudWatch RUM if available, otherwise console
logger.info('User logged in', { userId: '123' });
logger.error('API call failed', { endpoint: '/api/users', status: 500 });
```

### Backend Usage

```typescript
import {
  createHandler,
  createSuccessResponse,
  logger,
  commonSchemas,
} from '@awslambdahackathon/utils/backend';

const myHandler = async event => {
  logger.info('Request received', { path: event.path });

  const data = { message: 'Hello from Lambda!' };
  return createSuccessResponse(data);
};

export const handler = createHandler(myHandler, commonSchemas.health);
```

### General Usage

```typescript
import { isValidEmail, capitalize, z } from '@awslambdahackathon/utils';

// Validation
if (isValidEmail('user@example.com')) {
  console.log('Valid email');
}

// String utilities
const name = capitalize('john doe'); // "John Doe"

// Zod schemas
const userSchema = z.object({
  name: z.string(),
  email: z.string().email(),
});
```

## Build

The package builds separate files for each export:

```bash
npm run build
```

This generates:

- `dist/index.js` - Main export
- `dist/frontend.js` - Frontend-specific utilities
- `dist/lambda.js` - Backend-specific utilities
