import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  createSuccessResponse,
  logger,
  metrics,
  tracer,
} from '@awslambdahackathon/utils/backend';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

interface ChatMessage {
  message: string;
  sessionId?: string;
  timestamp: string;
}

interface ChatResponse {
  message: string;
  sessionId: string;
  timestamp: string;
  isEcho: boolean;
}

interface WebSocketEvent {
  action: string;
  message?: string;
  sessionId?: string;
}

interface Connection {
  connectionId: string;
  sessionId?: string;
  ttl: number;
  timestamp: string;
}

// Initialize DynamoDB client
const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

const websocketHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Add custom metric
  metrics.addMetric('WebSocketRequest', 'Count', 1);

  // Add custom dimension
  metrics.addDimension('Environment', process.env.ENVIRONMENT || 'dev');

  // Log the incoming request
  logger.info('WebSocket request received', {
    httpMethod: event.httpMethod,
    path: event.path,
    requestId: event.requestContext.requestId,
    body: event.body,
    eventType: event.requestContext.eventType,
  });

  // Create a custom span for business logic
  const segment = tracer.getSegment();
  const subsegment = segment?.addNewSubsegment('websocket-logic');

  try {
    // Ensure we have a connectionId
    const connectionId = event.requestContext.connectionId;
    logger.info('RequestContext', { requestContext: event.requestContext });
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

    logger.info('Event type', { eventType: event.requestContext.eventType });

    // Handle WebSocket connection
    if (event.requestContext.eventType === 'CONNECT') {
      const now = new Date();
      const connection: Connection = {
        connectionId,
        timestamp: now.toISOString(),
        ttl: Math.floor(now.getTime() / 1000) + 2 * 60 * 60, // 2 hours TTL for connections
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: '',
      };
    }

    // Handle WebSocket disconnection
    if (event.requestContext.eventType === 'DISCONNECT') {
      logger.info('Deleting connection from DynamoDB', { connectionId });
      await ddbDocClient.send(
        new DeleteCommand({
          TableName: process.env.WEBSOCKET_CONNECTIONS_TABLE,
          Key: {
            connectionId,
          },
        })
      );
      logger.info('Connection deleted successfully', { connectionId });

      return createSuccessResponse({
        statusCode: 200,
        body: JSON.stringify({ message: 'Disconnected' }),
      });
    }

    // Handle WebSocket message
    if (event.requestContext.eventType === 'MESSAGE') {
      logger.info('Processing MESSAGE event', { body: event.body });
      if (!event.body) {
        logger.error('Missing body in MESSAGE event', { event });
        return createSuccessResponse(
          {
            statusCode: 400,
            body: JSON.stringify({ error: 'Request body is required' }),
          },
          400
        );
      }

      let websocketEvent: WebSocketEvent;
      try {
        websocketEvent = JSON.parse(event.body);
      } catch (parseError) {
        logger.error('Failed to parse event.body as JSON', {
          body: event.body,
          parseError,
        });
        return createSuccessResponse(
          {
            statusCode: 400,
            body: JSON.stringify({ error: 'Invalid JSON in request body' }),
          },
          400
        );
      }
      const { action, message, sessionId } = websocketEvent;
      logger.info('Parsed WebSocketEvent', { action, message, sessionId });

      if (action === 'sendMessage') {
        if (!message) {
          logger.error('Missing message in sendMessage action', {
            websocketEvent,
          });
          return createSuccessResponse(
            {
              statusCode: 400,
              body: JSON.stringify({ error: 'Message is required' }),
            },
            400
          );
        }

        // Generate or use existing session ID
        const currentSessionId =
          sessionId ||
          `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const now = new Date();
        const timestamp = now.toISOString();

        // Update connection with session ID if needed
        if (sessionId) {
          logger.info('Updating connection with sessionId', {
            connectionId,
            sessionId: currentSessionId,
          });
          await ddbDocClient.send(
            new PutCommand({
              TableName: process.env.WEBSOCKET_CONNECTIONS_TABLE,
              Item: {
                connectionId,
                sessionId: currentSessionId,
                timestamp: now.toISOString(),
                ttl: Math.floor(now.getTime() / 1000) + 2 * 60 * 60, // 2 hours TTL
              },
            })
          );
          logger.info('Connection updated with sessionId', {
            connectionId,
            sessionId: currentSessionId,
          });
        }

        // Add user message to DynamoDB
        const userMessage: ChatMessage = {
          message,
          sessionId: currentSessionId,
          timestamp,
        };
        logger.info('Storing user message in DynamoDB', { userMessage });
        await ddbDocClient.send(
          new PutCommand({
            TableName: process.env.WEBSOCKET_MESSAGES_TABLE,
            Item: {
              ...userMessage,
              ttl: Math.floor(now.getTime() / 1000) + 24 * 60 * 60, // 24 hours TTL
              type: 'user',
              connectionId,
            },
          })
        );
        logger.info('User message stored successfully', { userMessage });

        // Echo the message back (initial behavior)
        const echoMessage = message;
        const response: ChatResponse = {
          message: echoMessage,
          sessionId: currentSessionId,
          timestamp: new Date().toISOString(),
          isEcho: true,
        };

        // Add bot response to DynamoDB
        const botMessage: ChatMessage = {
          message: echoMessage,
          sessionId: currentSessionId,
          timestamp: new Date().toISOString(),
        };
        logger.info('Storing bot message in DynamoDB', { botMessage });
        await ddbDocClient.send(
          new PutCommand({
            TableName: process.env.WEBSOCKET_MESSAGES_TABLE,
            Item: {
              ...botMessage,
              ttl: Math.floor(now.getTime() / 1000) + 24 * 60 * 60, // 24 hours TTL
              type: 'bot',
              connectionId,
            },
          })
        );
        logger.info('Bot message stored successfully', { botMessage });

        // Get session messages for logging
        logger.info('Querying recent session messages', {
          sessionId: currentSessionId,
        });
        const { Items: sessionMessages } = await ddbDocClient.send(
          new QueryCommand({
            TableName: process.env.WEBSOCKET_MESSAGES_TABLE,
            KeyConditionExpression: 'sessionId = :sessionId',
            ExpressionAttributeValues: {
              ':sessionId': currentSessionId,
            },
            ScanIndexForward: false, // Get most recent messages first
            Limit: 10,
          })
        );
        logger.info('Recent session messages', { sessionMessages });

        // Log successful response
        logger.info('WebSocket message processed successfully', {
          requestId: event.requestContext.requestId,
          sessionId: currentSessionId,
          messageLength: message.length,
          response: response,
          recentMessages: sessionMessages,
        });

        return createSuccessResponse({
          statusCode: 200,
          body: JSON.stringify(response),
        });
      }

      logger.error('Invalid action in MESSAGE event', { action });
      return createSuccessResponse(
        {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid action' }),
        },
        400
      );
    }

    logger.error('Invalid event type', {
      eventType: event.requestContext.eventType,
    });
    return createSuccessResponse(
      {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid event type' }),
      },
      400
    );
  } catch (error) {
    // Log error
    logger.error('Error in WebSocket handler', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestId: event.requestContext.requestId,
      event,
    });

    // Add error metric
    metrics.addMetric('WebSocketError', 'Count', 1);

    throw error; // Let the error handler middleware handle it
  } finally {
    // Close the subsegment
    subsegment?.close();
  }
};

// Export the handler directly (no Middy middleware for WebSocket)
export const handler = websocketHandler;
