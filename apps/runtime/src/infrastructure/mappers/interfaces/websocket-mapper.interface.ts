import {
  APIGatewayWebSocketConnectionDto,
  APIGatewayWebSocketErrorDto,
  APIGatewayWebSocketEventDto,
  APIGatewayWebSocketMessageDto,
  APIGatewayWebSocketResponseDto,
  WebSocketAuthEventDto,
  WebSocketConnectionEventDto,
  WebSocketCustomEventDto,
  WebSocketErrorEventDto,
  WebSocketEventUnionDto,
  WebSocketMessageEventDto,
  WebSocketPingEventDto,
} from '@awslambdahackathon/types';

import { Connection } from '../../../domain/entities/connection';
import { Message } from '../../../domain/entities/message';
import { User } from '../../../domain/entities/user';

/**
 * Interface for WebSocket event mappers
 */
export interface WebSocketEventMapper {
  /**
   * Maps Connection entity to WebSocket connection event
   */
  mapConnectionToEvent(
    connection: Connection,
    eventType: 'connection' | 'disconnection'
  ): WebSocketConnectionEventDto;

  /**
   * Maps User entity to WebSocket auth success event
   */
  mapUserToAuthSuccessEvent(
    user: User,
    connectionId: string,
    requestId?: string
  ): WebSocketAuthEventDto;

  /**
   * Creates WebSocket auth failure event
   */
  createAuthFailureEvent(
    connectionId: string,
    error: { code: string; message: string; details?: unknown },
    requestId?: string
  ): WebSocketAuthEventDto;

  /**
   * Maps Message entity to WebSocket message event
   */
  mapMessageToEvent(
    message: Message,
    connectionId: string,
    eventType?:
      | 'message'
      | 'message_sent'
      | 'message_received'
      | 'message_error'
  ): WebSocketMessageEventDto;

  /**
   * Creates WebSocket ping event
   */
  createPingEvent(connectionId: string, userId?: string): WebSocketPingEventDto;

  /**
   * Creates WebSocket pong event
   */
  createPongEvent(
    connectionId: string,
    pingTime: string,
    userId?: string
  ): WebSocketPingEventDto;

  /**
   * Creates WebSocket error event
   */
  createErrorEvent(
    connectionId: string,
    error: {
      code: string;
      message: string;
      details?: unknown;
      stack?: string;
    },
    severity?: 'low' | 'medium' | 'high' | 'critical',
    userId?: string
  ): WebSocketErrorEventDto;

  /**
   * Creates custom WebSocket event
   */
  createCustomEvent(
    eventName: string,
    payload: Record<string, unknown>,
    connectionId: string,
    userId?: string,
    version?: string
  ): WebSocketCustomEventDto;

  /**
   * Validates WebSocket event structure
   */
  validateEvent(event: unknown): {
    isValid: boolean;
    errors: string[];
  };
}

/**
 * Interface for API Gateway event mappers
 */
export interface APIGatewayEventMapper {
  /**
   * Maps API Gateway event to connection info
   */
  mapEventToConnectionInfo(
    event: APIGatewayWebSocketEventDto
  ): APIGatewayWebSocketConnectionDto;

  /**
   * Maps message body to DTO (expects pre-parsed data)
   */
  mapMessageBodyToDto(
    parsedBody: Record<string, unknown>,
    requestId: string
  ): APIGatewayWebSocketMessageDto;

  /**
   * Creates success response
   */
  createSuccessResponse(
    body?: string,
    headers?: Record<string, string>
  ): APIGatewayWebSocketResponseDto;

  /**
   * Creates error response DTO
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
  };

  /**
   * Creates connection response DTO
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
  };

  /**
   * Creates message response DTO
   */
  createMessageResponseDto(
    message: APIGatewayWebSocketMessageDto,
    success?: boolean
  ): {
    response: APIGatewayWebSocketResponseDto;
    responseBody: {
      success: boolean;
      message: APIGatewayWebSocketMessageDto;
      timestamp: string;
    };
  };

  /**
   * Creates WebSocket message DTO
   */
  createWebSocketMessageDto(
    action: string,
    data: Record<string, unknown>,
    messageId?: string
  ): APIGatewayWebSocketMessageDto;

  /**
   * Validates API Gateway WebSocket event
   */
  isValidWebSocketEvent(event: unknown): event is APIGatewayWebSocketEventDto;

  /**
   * Creates error DTO from error object
   */
  createErrorDto(
    error: Error,
    connectionId: string,
    requestId?: string
  ): APIGatewayWebSocketErrorDto;
}

/**
 * Type guards interface for WebSocket events
 */
export interface WebSocketEventTypeGuards {
  /**
   * Checks if event is a connection event
   */
  isConnectionEvent(
    event: WebSocketEventUnionDto
  ): event is WebSocketConnectionEventDto;

  /**
   * Checks if event is an auth event
   */
  isAuthEvent(event: WebSocketEventUnionDto): event is WebSocketAuthEventDto;

  /**
   * Checks if event is a message event
   */
  isMessageEvent(
    event: WebSocketEventUnionDto
  ): event is WebSocketMessageEventDto;

  /**
   * Checks if event is a ping/pong event
   */
  isPingEvent(event: WebSocketEventUnionDto): event is WebSocketPingEventDto;

  /**
   * Checks if event is an error event
   */
  isErrorEvent(event: WebSocketEventUnionDto): event is WebSocketErrorEventDto;

  /**
   * Checks if event is a custom event
   */
  isCustomEvent(
    event: WebSocketEventUnionDto
  ): event is WebSocketCustomEventDto;
}

/**
 * Combined interface for complete WebSocket event mapping
 */
export interface CompleteWebSocketEventMapper
  extends WebSocketEventMapper,
    WebSocketEventTypeGuards {}

/**
 * Type guards interface for API Gateway events
 */
export interface APIGatewayEventTypeGuards {
  /**
   * Checks if event is a connection event
   */
  isConnectionEvent(event: APIGatewayWebSocketEventDto): boolean;

  /**
   * Checks if event is a disconnection event
   */
  isDisconnectionEvent(event: APIGatewayWebSocketEventDto): boolean;

  /**
   * Checks if event is a message event
   */
  isMessageEvent(event: APIGatewayWebSocketEventDto): boolean;
}

/**
 * Interface for extracting data from API Gateway events
 */
export interface APIGatewayEventExtractor {
  /**
   * Extracts connection ID from event
   */
  getConnectionId(event: APIGatewayWebSocketEventDto): string;

  /**
   * Extracts request ID from event
   */
  getRequestId(event: APIGatewayWebSocketEventDto): string;

  /**
   * Gets event type from event
   */
  getEventType(
    event: APIGatewayWebSocketEventDto
  ): 'CONNECT' | 'DISCONNECT' | 'MESSAGE';

  /**
   * Gets route key from event
   */
  getRouteKey(event: APIGatewayWebSocketEventDto): string;

  /**
   * Extracts query parameters from event
   */
  getQueryParameters(
    event: APIGatewayWebSocketEventDto
  ): Record<string, string>;

  /**
   * Extracts headers from event
   */
  getHeaders(event: APIGatewayWebSocketEventDto): Record<string, string>;

  /**
   * Gets client IP address from event
   */
  getClientIp(event: APIGatewayWebSocketEventDto): string;

  /**
   * Gets user agent from event
   */
  getUserAgent(event: APIGatewayWebSocketEventDto): string | undefined;

  /**
   * Gets stage from event
   */
  getStage(event: APIGatewayWebSocketEventDto): string;

  /**
   * Gets domain name from event
   */
  getDomainName(event: APIGatewayWebSocketEventDto): string;

  /**
   * Gets API ID from event
   */
  getApiId(event: APIGatewayWebSocketEventDto): string;
}

/**
 * Complete interface for API Gateway event mapping
 */
export interface CompleteAPIGatewayEventMapper
  extends APIGatewayEventMapper,
    APIGatewayEventTypeGuards,
    APIGatewayEventExtractor {}
