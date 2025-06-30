import {
  APIGatewayWebSocketConnectionDto,
  APIGatewayWebSocketEventDto,
  APIGatewayWebSocketResponseDto,
} from '../../dto/websocket/api-gateway-event.dto';

/**
 * Mapper for API Gateway WebSocket events
 */
export class APIGatewayEventMapper {
  /**
   * Maps API Gateway WebSocket event to connection info
   */
  mapEventToConnectionInfo(
    event: APIGatewayWebSocketEventDto
  ): APIGatewayWebSocketConnectionDto {
    return {
      connectionId: event.requestContext.connectionId,
      connectionState:
        event.requestContext.eventType === 'CONNECT'
          ? 'CONNECTED'
          : 'DISCONNECTED',
      connectedAt:
        event.requestContext.connectedAt ||
        event.requestContext.requestTimeEpoch,
      lastActiveAt: event.requestContext.requestTimeEpoch,
      identity: {
        sourceIp: event.requestContext.identity.sourceIp,
        userAgent: event.requestContext.identity.userAgent,
      },
      stage: event.requestContext.stage,
      domainName: event.requestContext.domainName,
      apiId: event.requestContext.apiId,
    };
  }

  /**
   * Creates success response for API Gateway WebSocket
   */
  createSuccessResponse(body?: string): APIGatewayWebSocketResponseDto {
    return {
      statusCode: 200,
      body: body || JSON.stringify({ status: 'success' }),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }

  /**
   * Creates error response for API Gateway WebSocket
   */
  createErrorResponse(
    statusCode: number,
    message: string,
    errorCode?: string
  ): APIGatewayWebSocketResponseDto {
    return {
      statusCode,
      body: JSON.stringify({
        status: 'error',
        message,
        errorCode,
        timestamp: new Date().toISOString(),
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    };
  }

  /**
   * Validates API Gateway WebSocket event structure
   */
  isValidWebSocketEvent(event: unknown): event is APIGatewayWebSocketEventDto {
    if (!event || typeof event !== 'object') {
      return false;
    }

    const evt = event as Record<string, unknown>;
    const requestContext = evt.requestContext as Record<string, unknown>;

    return !!(
      requestContext &&
      typeof requestContext === 'object' &&
      typeof requestContext.connectionId === 'string' &&
      typeof requestContext.eventType === 'string' &&
      typeof requestContext.requestId === 'string'
    );
  }

  /**
   * Gets connection ID from API Gateway event
   */
  getConnectionId(event: APIGatewayWebSocketEventDto): string {
    return event.requestContext.connectionId;
  }

  /**
   * Gets event type from API Gateway event
   */
  getEventType(
    event: APIGatewayWebSocketEventDto
  ): 'CONNECT' | 'MESSAGE' | 'DISCONNECT' {
    return event.requestContext.eventType;
  }

  /**
   * Gets route key from API Gateway event
   */
  getRouteKey(event: APIGatewayWebSocketEventDto): string {
    return event.requestContext.routeKey;
  }
}
