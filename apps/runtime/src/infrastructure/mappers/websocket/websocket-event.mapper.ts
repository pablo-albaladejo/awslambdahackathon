import { Connection } from '../../../domain/entities/connection';
import { Message } from '../../../domain/entities/message';
import { User } from '../../../domain/entities/user';
import {
  WebSocketAuthEventDto,
  WebSocketConnectionEventDto,
  WebSocketCustomEventDto,
  WebSocketErrorEventDto,
  WebSocketEventUnionDto,
  WebSocketMessageEventDto,
  WebSocketPingEventDto,
} from '../../dto/websocket/websocket-event.dto';

/**
 * Mapper for WebSocket events
 */
export class WebSocketEventMapper {
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
          email: user.getEmail(),
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
   * Maps authentication error to WebSocket auth failure event
   */
  mapAuthErrorToEvent(
    error: Error,
    connectionId: string,
    requestId?: string
  ): WebSocketAuthEventDto {
    return {
      type: 'auth_failure',
      timestamp: new Date().toISOString(),
      connectionId,
      requestId,
      data: {
        error: {
          code: 'AUTH_FAILED',
          message: error.message,
          details: error.stack,
        },
      },
      metadata: {
        errorType: error.constructor.name,
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
   * Creates WebSocket pong event from ping event
   */
  createPongEvent(pingEvent: WebSocketPingEventDto): WebSocketPingEventDto {
    const now = new Date().toISOString();
    const pingTime = new Date(pingEvent.data.pingTime);
    const pongTime = new Date(now);
    const rtt = pongTime.getTime() - pingTime.getTime();

    return {
      type: 'pong',
      timestamp: now,
      connectionId: pingEvent.connectionId,
      userId: pingEvent.userId,
      data: {
        pingTime: pingEvent.data.pingTime,
        pongTime: now,
        rtt,
      },
    };
  }

  /**
   * Maps error to WebSocket error event
   */
  mapErrorToEvent(
    error: Error,
    connectionId: string,
    userId?: string,
    originalEvent?: Record<string, unknown>
  ): WebSocketErrorEventDto {
    return {
      type: 'error',
      timestamp: new Date().toISOString(),
      connectionId,
      userId,
      data: {
        code: error.name || 'UNKNOWN_ERROR',
        message: error.message,
        details: (error as any).cause,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        originalEvent,
      },
      metadata: {
        errorType: error.constructor.name,
        environment: process.env.NODE_ENV || 'development',
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
   * Serializes WebSocket event to JSON string
   */
  serializeEvent(event: WebSocketEventUnionDto): string {
    return JSON.stringify(event);
  }

  /**
   * Deserializes JSON string to WebSocket event
   */
  deserializeEvent(eventJson: string): WebSocketEventUnionDto {
    try {
      const parsed = JSON.parse(eventJson);

      // Validate required fields
      if (!parsed.type || !parsed.timestamp || !parsed.connectionId) {
        throw new Error(
          'Invalid WebSocket event format: missing required fields'
        );
      }

      return parsed as WebSocketEventUnionDto;
    } catch (error) {
      throw new Error(
        `Failed to deserialize WebSocket event: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Validates WebSocket event structure
   */
  isValidEvent(event: unknown): event is WebSocketEventUnionDto {
    if (!event || typeof event !== 'object') {
      return false;
    }

    const evt = event as Record<string, unknown>;

    return (
      typeof evt.type === 'string' &&
      typeof evt.timestamp === 'string' &&
      typeof evt.connectionId === 'string' &&
      (evt.userId === undefined || typeof evt.userId === 'string') &&
      (evt.data === undefined || typeof evt.data === 'object')
    );
  }

  /**
   * Gets event type from event object
   */
  getEventType(event: WebSocketEventUnionDto): string {
    return event.type;
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
      event.type === 'auth' ||
      event.type === 'auth_success' ||
      event.type === 'auth_failure'
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
    return event.type === 'error';
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
