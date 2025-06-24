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

// In-memory session storage (in production, use DynamoDB or similar)
const sessions = new Map<
  string,
  { messages: ChatMessage[]; lastActivity: Date }
>();

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
    // Handle WebSocket connection
    if (event.requestContext.eventType === 'CONNECT') {
      // For now, accept all connections without authentication
      // TODO: Add proper authentication later
      logger.info('WebSocket connection established', {
        connectionId: event.requestContext.connectionId,
      });

      // For WebSocket API Gateway v2, CONNECT should return 200 without body
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
      logger.info('WebSocket disconnected', {
        connectionId: event.requestContext.connectionId,
      });

      return createSuccessResponse({
        statusCode: 200,
        body: JSON.stringify({ message: 'Disconnected' }),
      });
    }

    // Handle WebSocket message
    if (event.requestContext.eventType === 'MESSAGE') {
      if (!event.body) {
        return createSuccessResponse(
          {
            statusCode: 400,
            body: JSON.stringify({ error: 'Request body is required' }),
          },
          400
        );
      }

      const websocketEvent: WebSocketEvent = JSON.parse(event.body);
      const { action, message, sessionId } = websocketEvent;

      if (action === 'sendMessage') {
        if (!message) {
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

        // Get or create session
        if (!sessions.has(currentSessionId)) {
          sessions.set(currentSessionId, {
            messages: [],
            lastActivity: new Date(),
          });
        }

        const session = sessions.get(currentSessionId)!;
        session.lastActivity = new Date();

        // Add user message to session
        const userMessage: ChatMessage = {
          message,
          sessionId: currentSessionId,
          timestamp: new Date().toISOString(),
        };
        session.messages.push(userMessage);

        // Echo the message back (initial behavior)
        const echoMessage = message;
        const response: ChatResponse = {
          message: echoMessage,
          sessionId: currentSessionId,
          timestamp: new Date().toISOString(),
          isEcho: true,
        };

        // Add bot response to session
        const botMessage: ChatMessage = {
          message: echoMessage,
          sessionId: currentSessionId,
          timestamp: new Date().toISOString(),
        };
        session.messages.push(botMessage);

        // Clean up old sessions (older than 24 hours)
        const now = new Date();
        for (const [sid, sessionData] of sessions.entries()) {
          if (
            now.getTime() - sessionData.lastActivity.getTime() >
            24 * 60 * 60 * 1000
          ) {
            sessions.delete(sid);
          }
        }

        // Log successful response
        logger.info('WebSocket message processed successfully', {
          requestId: event.requestContext.requestId,
          sessionId: currentSessionId,
          messageLength: message.length,
          response: response,
        });

        return createSuccessResponse({
          statusCode: 200,
          body: JSON.stringify(response),
        });
      }

      return createSuccessResponse(
        {
          statusCode: 400,
          body: JSON.stringify({ error: 'Invalid action' }),
        },
        400
      );
    }

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
