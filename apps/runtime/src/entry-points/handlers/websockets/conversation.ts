import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
  createSuccessResponse,
  logger,
  metrics,
  tracer,
} from '@awslambdahackathon/utils/lambda';
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

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  metrics.addMetric('WebSocketRequest', 'Count', 1);
  metrics.addDimension('Environment', process.env.ENVIRONMENT || 'dev');
  logger.info('WebSocket message event received', {
    httpMethod: event.httpMethod,
    path: event.path,
    requestId: event.requestContext.requestId,
    eventType: event.requestContext.eventType,
  });
  const segment = tracer.getSegment();
  const subsegment = segment?.addNewSubsegment('websocket-conversation-logic');
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
    if (event.requestContext.eventType !== 'MESSAGE') {
      logger.error('Invalid event type for conversation handler', {
        eventType: event.requestContext.eventType,
      });
      return createSuccessResponse(
        {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid event type' }),
        },
        400
      );
    }
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
    if (action !== 'sendMessage') {
      logger.error('Invalid action in MESSAGE event', { action });
      return createSuccessResponse(
        {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid action' }),
        },
        400
      );
    }
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
    const currentSessionId =
      sessionId ||
      `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const timestamp = now.toISOString();
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
    // Send the response back to the user via WebSocket
    const domain = event.requestContext.domainName;
    const stage = event.requestContext.stage;
    const endpoint = `https://${domain}/${stage}`;
    const apigwManagementApi = new ApiGatewayManagementApiClient({ endpoint });
    try {
      await apigwManagementApi.send(
        new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: Buffer.from(JSON.stringify(response)),
        })
      );
      logger.info('Message sent to client via WebSocket', {
        connectionId,
        response,
      });
    } catch (err) {
      logger.error('Failed to send message to client via WebSocket', {
        connectionId,
        error: err,
      });
    }
    logger.info('WebSocket message processed successfully', {
      requestId: event.requestContext.requestId,
      sessionId: currentSessionId,
      messageLength: message.length,
      response: response,
    });
    return createSuccessResponse({
      statusCode: 200,
      body: '',
    });
  } finally {
    subsegment?.close();
  }
};
