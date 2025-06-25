import {
  commonSchemas,
  createHandler,
  createSuccessResponse,
  logger,
  metrics,
  tracer,
} from '@awslambdahackathon/utils/lambda';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// Define the handler function
const healthHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Add custom metric
  metrics.addMetric('HealthCheck', 'Count', 1);

  // Add custom dimension
  metrics.addDimension('Environment', process.env.ENVIRONMENT || 'dev');

  // Log the incoming request
  logger.info('Health check requested', {
    httpMethod: event.httpMethod,
    path: event.path,
    queryParams: event.queryStringParameters,
    requestId: event.requestContext.requestId,
  });

  // Create a custom span for business logic
  const segment = tracer.getSegment();
  const subsegment = segment?.addNewSubsegment('health-check-logic');

  try {
    const message = {
      message: 'Hello from AWS Lambda!',
      timestamp: new Date().toISOString(),
      environment: process.env.ENVIRONMENT || 'dev',
      event: {
        httpMethod: event.httpMethod,
        path: event.path,
        queryStringParameters: event.queryStringParameters,
        requestId: event.requestContext.requestId,
      },
    };

    // Log successful response
    logger.info('Health check completed successfully', {
      requestId: event.requestContext.requestId,
      response: message,
    });

    return createSuccessResponse(message);
  } catch (error) {
    // Log error
    logger.error('Error in health check handler', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestId: event.requestContext.requestId,
    });

    // Add error metric
    metrics.addMetric('HealthCheckError', 'Count', 1);

    throw error; // Let the error handler middleware handle it
  } finally {
    // Close the subsegment
    subsegment?.close();
  }
};

// Export the handler wrapped with Middy middleware
export const handler = createHandler(healthHandler, commonSchemas.health);
