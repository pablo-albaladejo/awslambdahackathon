# @awslambdahackathon/utils

This package provides utilities for both frontend and runtime applications with environment-specific exports.

## Overview

The utils package is designed to provide shared utilities across the monorepo, with specific exports for different environments:

- **Frontend utilities** (`@awslambdahackathon/utils/frontend`) - Browser-safe utilities
- **Runtime utilities** (`@awslambdahackathon/utils/lambda`) - Lambda function utilities

## Installation

```bash
npm install @awslambdahackathon/utils
```

## Usage

### Frontend-Specific Utilities

```typescript
import { logger } from '@awslambdahackathon/utils/frontend';

logger.info('Hello from frontend!');
```

### Runtime-Specific Utilities (Lambda)

```typescript
import {
  logger,
  metrics,
  tracer,
  createHandler,
  createSuccessResponse,
} from '@awslambdahackathon/utils/lambda';

export const handler = createHandler(async event => {
  logger.info('Processing request');
  metrics.addMetric('RequestCount', 'Count', 1);
  return createSuccessResponse({ message: 'Hello from Lambda!' });
});
```

## Available Utilities

### Common Utilities (from main export)

- `isValidEmail` - Email validation
- `isValidUUID` - UUID validation
- `capitalize` - String capitalization
- `generateId` - Generate unique IDs

### Frontend Export (`@awslambdahackathon/utils/frontend`)

- `logger` - Environment-aware logger (frontend/runtime)

### Runtime Export (`@awslambdahackathon/utils/lambda`)

- `logger` - AWS Lambda Powertools logger
- `metrics` - AWS Lambda Powertools metrics
- `tracer` - AWS Lambda Powertools tracer
- `createHandler` - Middy handler factory
- `createSuccessResponse` - Success response helper
- `createErrorResponse` - Error response helper
- `requestResponseLogger` - Request/response logging middleware
- `commonSchemas` - Common Zod validation schemas

## Package Structure

```
src/
├── index.ts          # Common utilities
├── frontend.ts       # Frontend-specific utilities
└── lambda.ts         # Runtime-specific utilities
dist/
├── index.js          # Common utilities
├── frontend.js       # Frontend-specific utilities
└── lambda.js         # Runtime-specific utilities
```

## Runtime Usage

The runtime export provides comprehensive utilities for AWS Lambda functions:

```typescript
import {
  commonSchemas,
  createHandler,
  createSuccessResponse,
  logger,
  metrics,
  tracer,
} from '@awslambdahackathon/utils/lambda';

const handler = async event => {
  // Add custom metric
  metrics.addMetric('CustomMetric', 'Count', 1);

  // Log with structured logging
  logger.info('Processing request', {
    requestId: event.requestContext.requestId,
    path: event.path,
  });

  // Create custom span
  const segment = tracer.getSegment();
  const subsegment = segment?.addNewSubsegment('business-logic');

  try {
    // Your business logic here
    return createSuccessResponse({ result: 'success' });
  } finally {
    subsegment?.close();
  }
};

// Export with middleware
export const lambdaHandler = createHandler(handler, commonSchemas.health);
```

## Development

```bash
# Build
npm run build

# Type check
npm run type-check

# Test
npm run test

# Clean
npm run clean
