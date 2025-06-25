import {
  commonSchemas,
  createHandler,
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

// In-memory session storage (in production, use DynamoDB or similar)
const sessions = new Map<
  string,
  { messages: ChatMessage[]; lastActivity: Date }
>();

const mcpHostHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Add custom metric
  metrics.addMetric('MCPHostRequest', 'Count', 1);

  // Add custom dimension
  metrics.addDimension('Environment', process.env.ENVIRONMENT || 'dev');

  // Log the incoming request
  logger.info('MCP Host request received', {
    httpMethod: event.httpMethod,
    path: event.path,
    requestId: event.requestContext.requestId,
    body: event.body,
  });

  // Create a custom span for business logic
  const segment = tracer.getSegment();
  const subsegment = segment?.addNewSubsegment('mcp-host-logic');

  try {
    if (!event.body) {
      return createSuccessResponse(
        {
          error: 'Request body is required',
        },
        400
      );
    }

    const requestBody: ChatMessage = JSON.parse(event.body);
    const { message, sessionId } = requestBody;

    if (!message) {
      return createSuccessResponse(
        {
          error: 'Message is required',
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
    logger.info('MCP Host request completed successfully', {
      requestId: event.requestContext.requestId,
      sessionId: currentSessionId,
      messageLength: message.length,
      response: response,
    });

    return createSuccessResponse(response);
  } catch (error) {
    // Log error
    logger.error('Error in MCP Host handler', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      requestId: event.requestContext.requestId,
    });

    // Add error metric
    metrics.addMetric('MCPHostError', 'Count', 1);

    throw error; // Let the error handler middleware handle it
  } finally {
    // Close the subsegment
    subsegment?.close();
  }
};

// Export the handler wrapped with Middy middleware
export const handler = createHandler(mcpHostHandler, commonSchemas.health);
