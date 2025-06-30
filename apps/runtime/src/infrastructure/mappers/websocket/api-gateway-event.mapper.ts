import {
  APIGatewayWebSocketConnectionDto,
  APIGatewayWebSocketErrorDto,
  APIGatewayWebSocketEventDto,
  APIGatewayWebSocketMessageDto,
  APIGatewayWebSocketResponseDto,
} from '@awslambdahackathon/types';
import { CompleteAPIGatewayEventMapper } from '@infrastructure/mappers/interfaces/websocket-mapper.interface';

/**
 * Mapper for API Gateway WebSocket events
 */
export class APIGatewayEventMapper implements CompleteAPIGatewayEventMapper {
  /**
   * Maps API Gateway event to connection info
   */
  mapEventToConnectionInfo(
    event: APIGatewayWebSocketEventDto
  ): APIGatewayWebSocketConnectionDto {
    const now = new Date().toISOString();

    return {
      connectionId: event.requestContext.connectionId,
      connectedAt: new Date(
        event.requestContext.requestTimeEpoch
      ).toISOString(),
      lastActivityAt: now,
      status:
        event.requestContext.eventType === 'CONNECT'
          ? 'CONNECTED'
          : 'DISCONNECTED',
      metadata: {
        sourceIp: event.requestContext.identity.sourceIp,
        userAgent: event.requestContext.identity.userAgent,
        stage: event.requestContext.stage,
        domainName: event.requestContext.domainName,
      },
    };
  }

  /**
   * Extracts connection ID from API Gateway event
   */
  getConnectionId(event: APIGatewayWebSocketEventDto): string {
    return event.requestContext.connectionId;
  }

  /**
   * Extracts request ID from API Gateway event
   */
  getRequestId(event: APIGatewayWebSocketEventDto): string {
    return event.requestContext.requestId;
  }

  /**
   * Gets event type from API Gateway event
   */
  getEventType(
    event: APIGatewayWebSocketEventDto
  ): 'CONNECT' | 'DISCONNECT' | 'MESSAGE' {
    return event.requestContext.eventType;
  }

  /**
   * Gets route key from API Gateway event
   */
  getRouteKey(event: APIGatewayWebSocketEventDto): string {
    return event.requestContext.routeKey;
  }

  /**
   * Maps message body from API Gateway event to message DTO
   * Note: JSON parsing should be handled by the service layer
   */
  mapMessageBodyToDto(
    parsedBody: Record<string, unknown>,
    requestId: string
  ): APIGatewayWebSocketMessageDto {
    return {
      action: (parsedBody.action as string) || 'unknown',
      data: (parsedBody.data as Record<string, unknown>) || {},
      messageId: parsedBody.messageId as string,
      timestamp: (parsedBody.timestamp as string) || new Date().toISOString(),
      type: parsedBody.type as string,
      userId: parsedBody.userId as string,
      sessionId: parsedBody.sessionId as string,
      requestId,
    };
  }

  /**
   * Creates success response
   * Note: Body serialization should be handled by the service layer
   */
  createSuccessResponse(
    body?: string,
    headers?: Record<string, string>
  ): APIGatewayWebSocketResponseDto {
    return {
      statusCode: 200,
      body: body || '',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };
  }

  /**
   * Creates error response DTO
   * Note: Body serialization should be handled by the service layer
   */
  createErrorResponseDto(
    statusCode: number,
    message: string,
    errorCode?: string,
    headers?: Record<string, string>
  ): {
    response: APIGatewayWebSocketResponseDto;
    errorBody: {
      success: false;
      error: {
        code: string;
        message: string;
        timestamp: string;
      };
    };
  } {
    const errorBody = {
      success: false as const,
      error: {
        code: errorCode || 'UNKNOWN_ERROR',
        message,
        timestamp: new Date().toISOString(),
      },
    };

    return {
      response: {
        statusCode,
        body: '', // Body will be set by service layer
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      },
      errorBody,
    };
  }

  /**
   * Creates connection response DTO
   * Note: Body serialization should be handled by the service layer
   */
  createConnectionResponseDto(
    success: boolean,
    connectionId: string,
    userId?: string
  ): {
    response: APIGatewayWebSocketResponseDto;
    responseBody: {
      success: boolean;
      connectionId: string;
      userId?: string;
      timestamp: string;
    };
  } {
    const responseBody = {
      success,
      connectionId,
      userId,
      timestamp: new Date().toISOString(),
    };

    return {
      response: {
        statusCode: success ? 200 : 403,
        body: '', // Body will be set by service layer
        headers: {
          'Content-Type': 'application/json',
        },
      },
      responseBody,
    };
  }

  /**
   * Creates message response DTO
   * Note: Body serialization should be handled by the service layer
   */
  createMessageResponseDto(
    message: APIGatewayWebSocketMessageDto,
    success: boolean = true
  ): {
    response: APIGatewayWebSocketResponseDto;
    responseBody: {
      success: boolean;
      message: APIGatewayWebSocketMessageDto;
      timestamp: string;
    };
  } {
    const responseBody = {
      success,
      message,
      timestamp: new Date().toISOString(),
    };

    return {
      response: {
        statusCode: success ? 200 : 400,
        body: '', // Body will be set by service layer
        headers: {
          'Content-Type': 'application/json',
        },
      },
      responseBody,
    };
  }

  /**
   * Validates API Gateway WebSocket event
   */
  isValidWebSocketEvent(event: unknown): event is APIGatewayWebSocketEventDto {
    if (!event || typeof event !== 'object') {
      return false;
    }

    const eventObj = event as Record<string, unknown>;

    // Check required requestContext
    if (
      !eventObj.requestContext ||
      typeof eventObj.requestContext !== 'object'
    ) {
      return false;
    }

    const requestContext = eventObj.requestContext as Record<string, unknown>;

    return !!(
      requestContext.connectionId &&
      requestContext.eventType &&
      requestContext.requestId &&
      requestContext.apiId &&
      requestContext.stage
    );
  }

  /**
   * Extracts query parameters from event
   */
  getQueryParameters(
    event: APIGatewayWebSocketEventDto
  ): Record<string, string> {
    return event.queryStringParameters || {};
  }

  /**
   * Extracts headers from event
   */
  getHeaders(event: APIGatewayWebSocketEventDto): Record<string, string> {
    return event.headers || {};
  }

  /**
   * Creates error DTO from error object
   */
  createErrorDto(
    error: Error,
    connectionId: string,
    requestId?: string
  ): APIGatewayWebSocketErrorDto {
    return {
      code: error.name || 'UNKNOWN_ERROR',
      message: error.message,
      details: error.stack,
      requestId,
      connectionId,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Checks if event is a connection event
   */
  isConnectionEvent(event: APIGatewayWebSocketEventDto): boolean {
    return event.requestContext.eventType === 'CONNECT';
  }

  /**
   * Checks if event is a disconnection event
   */
  isDisconnectionEvent(event: APIGatewayWebSocketEventDto): boolean {
    return event.requestContext.eventType === 'DISCONNECT';
  }

  /**
   * Checks if event is a message event
   */
  isMessageEvent(event: APIGatewayWebSocketEventDto): boolean {
    return event.requestContext.eventType === 'MESSAGE';
  }

  /**
   * Gets client IP address from event
   */
  getClientIp(event: APIGatewayWebSocketEventDto): string {
    return event.requestContext.identity.sourceIp;
  }

  /**
   * Gets user agent from event
   */
  getUserAgent(event: APIGatewayWebSocketEventDto): string | undefined {
    return event.requestContext.identity.userAgent;
  }

  /**
   * Creates WebSocket message DTO for sending to client
   * Note: Serialization should be handled by the service layer
   */
  createWebSocketMessageDto(
    action: string,
    data: Record<string, unknown>,
    messageId?: string
  ): APIGatewayWebSocketMessageDto {
    return {
      action,
      data,
      messageId: messageId || `msg_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Gets stage from event
   */
  getStage(event: APIGatewayWebSocketEventDto): string {
    return event.requestContext.stage;
  }

  /**
   * Gets domain name from event
   */
  getDomainName(event: APIGatewayWebSocketEventDto): string {
    return event.requestContext.domainName;
  }

  /**
   * Gets API ID from event
   */
  getApiId(event: APIGatewayWebSocketEventDto): string {
    return event.requestContext.apiId;
  }
}
