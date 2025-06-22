"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const backend_1 = require("@awslambdahackathon/utils/backend");
// Define the handler function
const healthHandler = async (event) => {
    // Add custom metric
    backend_1.metrics.addMetric('HealthCheck', 'Count', 1);
    // Add custom dimension
    backend_1.metrics.addDimension('Environment', process.env.ENVIRONMENT || 'dev');
    // Log the incoming request
    backend_1.logger.info('Health check requested', {
        httpMethod: event.httpMethod,
        path: event.path,
        queryParams: event.queryStringParameters,
        requestId: event.requestContext.requestId,
    });
    // Create a custom span for business logic
    const segment = backend_1.tracer.getSegment();
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
        backend_1.logger.info('Health check completed successfully', {
            requestId: event.requestContext.requestId,
            response: message,
        });
        return (0, backend_1.createSuccessResponse)(message);
    }
    catch (error) {
        // Log error
        backend_1.logger.error('Error in health check handler', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            requestId: event.requestContext.requestId,
        });
        // Add error metric
        backend_1.metrics.addMetric('HealthCheckError', 'Count', 1);
        throw error; // Let the error handler middleware handle it
    }
    finally {
        // Close the subsegment
        subsegment?.close();
    }
};
// Export the handler wrapped with Middy middleware
exports.handler = (0, backend_1.createHandler)(healthHandler, backend_1.commonSchemas.health);
