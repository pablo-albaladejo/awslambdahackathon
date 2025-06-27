import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  createSuccessResponse,
  logger,
  metrics,
  tracer,
} from '@awslambdahackathon/utils/lambda';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

import { authenticationService } from '../../../services/authentication-service';
import {
  createError,
  createErrorResponse,
  errorHandlingService,
  ErrorType,
  handleError,
} from '../../../services/error-handling-service';

interface Connection {
  connectionId: string;
  sessionId?: string;
  ttl: number;
  timestamp: string;
}

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  metrics.addMetric('WebSocketRequest', 'Count', 1);
  metrics.addDimension('Environment', process.env.ENVIRONMENT || 'dev');

  logger.info('WebSocket connection event received', {
    httpMethod: event.httpMethod,
    path: event.path,
    requestId: event.requestContext.requestId,
    eventType: event.requestContext.eventType,
  });

  const segment = tracer.getSegment();
  const subsegment = segment?.addNewSubsegment('websocket-connection-logic');

  try {
    const connectionId = event.requestContext.connectionId;
    if (!connectionId) {
      const error = createError(
        ErrorType.VALIDATION_ERROR,
        'Missing connection ID',
        'MISSING_CONNECTION_ID',
        { requestContext: event.requestContext }
      );

      logger.error('Missing connectionId in requestContext', {
        requestContext: event.requestContext,
      });

      return createErrorResponse(error, event);
    }

    if (event.requestContext.eventType === 'CONNECT') {
      return await handleConnect(connectionId, event);
    }

    if (event.requestContext.eventType === 'DISCONNECT') {
      return await handleDisconnect(connectionId, event);
    }

    const error = createError(
      ErrorType.VALIDATION_ERROR,
      'Invalid event type for connection handler',
      'INVALID_EVENT_TYPE',
      {
        expectedTypes: ['CONNECT', 'DISCONNECT'],
        actualType: event.requestContext.eventType,
      }
    );

    logger.error('Invalid event type for connection handler', {
      eventType: event.requestContext.eventType,
    });

    return createErrorResponse(error, event);
  } catch (error) {
    const appError = handleError(error as Error, {
      requestId: event.requestContext.requestId,
      connectionId: event.requestContext.connectionId,
      action: 'websocket_connection',
      event,
    });

    return createErrorResponse(appError, event);
  } finally {
    subsegment?.close();
  }
};

/**
 * Handle WebSocket connection
 */
async function handleConnect(
  connectionId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const now = new Date();
    const connection: Connection = {
      connectionId,
      timestamp: now.toISOString(),
      ttl: Math.floor(now.getTime() / 1000) + 2 * 60 * 60, // 2 hours TTL
    };

    logger.info('Storing connection in DynamoDB', { connection });

    try {
      await ddbDocClient.send(
        new PutCommand({
          TableName: process.env.WEBSOCKET_CONNECTIONS_TABLE,
          Item: connection,
        })
      );
    } catch (dbError) {
      const error = errorHandlingService.handleDatabaseError(
        dbError,
        'store_connection',
        { connectionId }
      );

      throw error;
    }

    logger.info('Connection stored successfully', { connectionId });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: '',
    };
  } catch (error) {
    const appError = handleError(error as Error, {
      connectionId,
      action: 'connect',
      event,
    });

    return createErrorResponse(appError, event);
  }
}

/**
 * Handle WebSocket disconnection
 */
async function handleDisconnect(
  connectionId: string,
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    logger.info('Processing disconnect event', { connectionId });

    // Delete connection from DynamoDB
    try {
      await ddbDocClient.send(
        new DeleteCommand({
          TableName: process.env.WEBSOCKET_CONNECTIONS_TABLE,
          Key: { connectionId },
        })
      );
    } catch (dbError) {
      const error = errorHandlingService.handleDatabaseError(
        dbError,
        'delete_connection',
        { connectionId }
      );

      // Log the error but don't fail the disconnect operation
      logger.warn('Failed to delete connection from DynamoDB', {
        connectionId,
        error: error.message,
      });
    }

    // Clean up authenticated connection from DynamoDB
    try {
      await authenticationService.removeAuthenticatedConnection(connectionId);
    } catch (authError) {
      // Log the error but don't fail the disconnect operation
      logger.warn('Failed to remove authenticated connection', {
        connectionId,
        error:
          authError instanceof Error ? authError.message : String(authError),
      });
    }

    logger.info('Connection cleanup completed', { connectionId });

    return createSuccessResponse({
      statusCode: 200,
      body: JSON.stringify({ message: 'Disconnected' }),
    });
  } catch (error) {
    const appError = handleError(error as Error, {
      connectionId,
      action: 'disconnect',
      event,
    });

    // For disconnect, we still want to return success even if cleanup fails
    logger.warn('Error during disconnect cleanup', {
      connectionId,
      error: appError.message,
    });

    return createSuccessResponse({
      statusCode: 200,
      body: JSON.stringify({ message: 'Disconnected' }),
    });
  }
}
