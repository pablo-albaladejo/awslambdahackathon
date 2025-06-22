# API Handlers with Middy, Zod, and Lambda Powertools

This API uses a modern stack for AWS Lambda handlers with:

- **Middy**: Middleware framework for AWS Lambda
- **Zod**: TypeScript-first schema validation
- **Lambda Powertools**: Centralized logging, tracing, and metrics

## Handler Structure

All handlers follow this pattern:

```typescript
import {
  createSuccessResponse,
  createHandler,
  logger,
  tracer,
  metrics,
  z,
} from '@awslambdahackathon/utils';

// Define Zod schema for validation
const requestSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    email: z.string().email(),
  }),
});

// Define the handler function
const myHandler = async (event: APIGatewayProxyEvent) => {
  // Add metrics
  metrics.addMetric('MyOperation', 'Count', 1);

  // Log incoming request
  logger.info('Operation started', {
    requestId: event.requestContext.requestId,
  });

  // Create custom span
  const segment = tracer.getSegment();
  const subsegment = segment?.addNewSubsegment('business-logic');

  try {
    // Your business logic here
    const result = { message: 'Success' };

    logger.info('Operation completed', { result });
    return createSuccessResponse(result);
  } catch (error) {
    logger.error('Operation failed', { error: error.message });
    metrics.addMetric('MyOperationError', 'Count', 1);
    throw error;
  } finally {
    subsegment?.close();
  }
};

// Export with middleware
export const handler = createHandler(myHandler, requestSchema);
```

## Available Middleware

The `createHandler` function automatically includes:

1. **JSON Body Parser**: Parses JSON request bodies
2. **CORS**: Handles CORS headers
3. **Request/Response Logger**: Automatic logging of all requests and responses
4. **Error Handler**: Standardized error responses
5. **Validator**: Schema validation (if schema provided)

## Logging

All handlers use centralized logging with Lambda Powertools:

```typescript
// Info logging
logger.info('Operation completed', {
  requestId: event.requestContext.requestId,
  result: data,
});

// Error logging
logger.error('Operation failed', {
  error: error.message,
  stack: error.stack,
  requestId: event.requestContext.requestId,
});
```

## Metrics

Add custom metrics to track business operations:

```typescript
// Count metric
metrics.addMetric('UserCreated', 'Count', 1);

// Custom dimension
metrics.addDimension('Environment', process.env.ENVIRONMENT);

// Error metric
metrics.addMetric('UserCreationError', 'Count', 1);
```

## Tracing

Create custom spans for business logic:

```typescript
const segment = tracer.getSegment();
const subsegment = segment?.addNewSubsegment('user-validation');

try {
  // Your logic here
} finally {
  subsegment?.close();
}
```

## Validation

Use Zod schemas for request validation:

```typescript
const userSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email'),
    age: z.number().int().positive().optional(),
  }),
  queryStringParameters: z.record(z.string()).optional(),
});

export const handler = createHandler(userHandler, userSchema);
```

## Environment Variables

Set these environment variables for optimal configuration:

```bash
LOG_LEVEL=INFO  # DEBUG, INFO, WARN, ERROR
ENVIRONMENT=dev # dev, staging, prod
```

## Error Handling

Errors are automatically handled by the middleware:

- Validation errors return 400 with detailed error messages
- Unhandled errors return 500 with generic error message
- All errors are logged with full context
