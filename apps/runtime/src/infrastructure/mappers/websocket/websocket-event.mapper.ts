import {
  WebSocketAuthEventDto,
  WebSocketConnectionEventDto,
  WebSocketCustomEventDto,
  WebSocketErrorEventDto,
  WebSocketEventUnionDto,
  WebSocketMessageEventDto,
  WebSocketPingEventDto,
} from '@awslambdahackathon/types';
import { Connection } from '@domain/entities/connection';
import { Message } from '@domain/entities/message';
import { User } from '@domain/entities/user';
import { CompleteWebSocketEventMapper } from '@infrastructure/mappers/interfaces/websocket-mapper.interface';

/**
 * Mapper for WebSocket events
 */
export class WebSocketEventMapper implements CompleteWebSocketEventMapper {
  /**
   * Maps Connection entity to WebSocket connection event
   */
  mapConnectionToEvent(
    connection: Connection,
    eventType: 'connection' | 'disconnection'
  ): WebSocketConnectionEventDto {
    return {
      type: eventType,
      timestamp: new Date().toISOString(),
      connectionId: connection.getId().getValue(),
      userId: connection.getUserId()?.getValue(),
      data: {
        connectedAt: connection.getConnectedAt().toISOString(),
        source: 'API_GATEWAY',
        routeKey: eventType === 'connection' ? '$connect' : '$disconnect',
        stage: process.env.STAGE || 'dev',
        domainName: process.env.WEBSOCKET_DOMAIN || 'localhost',
      },
      metadata: {
        connectionStatus: connection.getStatus(),
        lastActivity: connection.getLastActivityAt().toISOString(),
      },
    };
  }

  /**
   * Maps User entity to WebSocket auth success event
   */
  mapUserToAuthSuccessEvent(
    user: User,
    connectionId: string,
    requestId?: string
  ): WebSocketAuthEventDto {
    return {
      type: 'auth_success',
      timestamp: new Date().toISOString(),
      connectionId,
      userId: user.getUserId(),
      requestId,
      data: {
        user: {
          id: user.getUserId(),
          username: user.getUsername(),
          groups: user.getGroups(),
        },
      },
      metadata: {
        userActive: user.isActive(),
        lastActivity: user.getLastActivityAt().toISOString(),
      },
    };
  }

  /**
   * Creates WebSocket auth failure event
   */
  createAuthFailureEvent(
    connectionId: string,
    error: { code: string; message: string; details?: unknown },
    requestId?: string
  ): WebSocketAuthEventDto {
    return {
      type: 'auth_failure',
      timestamp: new Date().toISOString(),
      connectionId,
      requestId,
      data: {
        error,
      },
    };
  }

  /**
   * Maps Message entity to WebSocket message event
   */
  mapMessageToEvent(
    message: Message,
    connectionId: string,
    eventType:
      | 'message'
      | 'message_sent'
      | 'message_received'
      | 'message_error' = 'message'
  ): WebSocketMessageEventDto {
    return {
      type: eventType,
      timestamp: new Date().toISOString(),
      connectionId,
      userId: message.getUserId().getValue(),
      data: {
        messageId: message.getId().getValue(),
        content: message.getContent(),
        messageType: message.getType(),
        senderId: message.getUserId().getValue(),
        timestamp: message.getCreatedAt().toISOString(),
        metadata: message.getMetadata(),
      },
      metadata: {
        messageStatus: message.getStatus(),
        sessionId: message.getSessionId().getValue(),
      },
    };
  }

  /**
   * Creates WebSocket ping event
   */
  createPingEvent(
    connectionId: string,
    userId?: string
  ): WebSocketPingEventDto {
    const now = new Date().toISOString();

    return {
      type: 'ping',
      timestamp: now,
      connectionId,
      userId,
      data: {
        pingTime: now,
      },
    };
  }

  /**
   * Creates WebSocket pong event
   */
  createPongEvent(
    connectionId: string,
    pingTime: string,
    userId?: string
  ): WebSocketPingEventDto {
    const now = new Date().toISOString();
    const rtt = Date.now() - new Date(pingTime).getTime();

    return {
      type: 'pong',
      timestamp: now,
      connectionId,
      userId,
      data: {
        pingTime,
        pongTime: now,
        rtt,
      },
    };
  }

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
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    userId?: string
  ): WebSocketErrorEventDto {
    return {
      type: 'error',
      timestamp: new Date().toISOString(),
      connectionId,
      userId,
      data: {
        code: error.code,
        message: error.message,
        details: error.details,
        stack: error.stack,
      },
      metadata: {
        severity,
        retryable: severity === 'low' || severity === 'medium',
      },
    };
  }

  /**
   * Creates custom WebSocket event
   */
  createCustomEvent(
    eventName: string,
    payload: Record<string, unknown>,
    connectionId: string,
    userId?: string,
    version?: string
  ): WebSocketCustomEventDto {
    return {
      type: 'custom',
      timestamp: new Date().toISOString(),
      connectionId,
      userId,
      data: {
        eventName,
        payload,
        version,
      },
    };
  }

  /**
   * Validates WebSocket event structure
   */
  validateEvent(event: unknown): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!event || typeof event !== 'object') {
      errors.push('Event must be an object');
      return { isValid: false, errors };
    }

    const eventObj = event as Record<string, unknown>;

    if (!eventObj.type || typeof eventObj.type !== 'string') {
      errors.push('Event must have a type field');
    }

    if (!eventObj.timestamp || typeof eventObj.timestamp !== 'string') {
      errors.push('Event must have a timestamp field');
    }

    if (!eventObj.connectionId || typeof eventObj.connectionId !== 'string') {
      errors.push('Event must have a connectionId field');
    }

    if (!eventObj.data || typeof eventObj.data !== 'object') {
      errors.push('Event must have a data field');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Checks if event is a connection event
   */
  isConnectionEvent(
    event: WebSocketEventUnionDto
  ): event is WebSocketConnectionEventDto {
    return event.type === 'connection' || event.type === 'disconnection';
  }

  /**
   * Checks if event is an auth event
   */
  isAuthEvent(event: WebSocketEventUnionDto): event is WebSocketAuthEventDto {
    return (
      event.type === 'auth_success' ||
      event.type === 'auth_failure' ||
      event.type === 'auth_required'
    );
  }

  /**
   * Checks if event is a message event
   */
  isMessageEvent(
    event: WebSocketEventUnionDto
  ): event is WebSocketMessageEventDto {
    return (
      event.type === 'message' ||
      event.type === 'message_sent' ||
      event.type === 'message_received' ||
      event.type === 'message_error'
    );
  }

  /**
   * Checks if event is a ping/pong event
   */
  isPingEvent(event: WebSocketEventUnionDto): event is WebSocketPingEventDto {
    return event.type === 'ping' || event.type === 'pong';
  }

  /**
   * Checks if event is an error event
   */
  isErrorEvent(event: WebSocketEventUnionDto): event is WebSocketErrorEventDto {
    return event.type === 'error' || event.type === 'warning';
  }

  /**
   * Checks if event is a custom event
   */
  isCustomEvent(
    event: WebSocketEventUnionDto
  ): event is WebSocketCustomEventDto {
    return event.type === 'custom';
  }
}
