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
      logger.error('Missing connectionId in requestContext', {
        requestContext: event.requestContext,
      });
      return createSuccessResponse(
        {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing connection ID' }),
        },
        400
      );
    }
    if (event.requestContext.eventType === 'CONNECT') {
      const now = new Date();
      const connection: Connection = {
        connectionId,
        timestamp: now.toISOString(),
        ttl: Math.floor(now.getTime() / 1000) + 2 * 60 * 60,
      };
      logger.info('Storing connection in DynamoDB', { connection });
      await ddbDocClient.send(
        new PutCommand({
          TableName: process.env.WEBSOCKET_CONNECTIONS_TABLE,
          Item: connection,
        })
      );
      logger.info('Connection stored successfully', { connectionId });
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: '',
      };
    }
    if (event.requestContext.eventType === 'DISCONNECT') {
      logger.info('Processing disconnect event', { connectionId });
      logger.info('Deleting connection from DynamoDB', { connectionId });
      await ddbDocClient.send(
        new DeleteCommand({
          TableName: process.env.WEBSOCKET_CONNECTIONS_TABLE,
          Key: { connectionId },
        })
      );
      logger.info('Connection deleted successfully', { connectionId });
      authenticationService.removeAuthenticatedConnection(connectionId);
      logger.info('Connection cleanup completed', { connectionId });
      return createSuccessResponse({
        statusCode: 200,
        body: JSON.stringify({ message: 'Disconnected' }),
      });
    }
    logger.error('Invalid event type for connection handler', {
      eventType: event.requestContext.eventType,
    });
    return createSuccessResponse(
      {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid event type' }),
      },
      400
    );
  } finally {
    subsegment?.close();
  }
};
