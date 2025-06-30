import { ConnectionId } from '@domain/value-objects';

export interface CommunicationMessage {
  type: 'auth' | 'chat' | 'system' | 'error' | 'ping';
  content: string;
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}

export interface AuthenticationResponse {
  success: boolean;
  user?: {
    id: string;
    username: string;
    email: string;
    groups: string[];
  };
  error?: string;
  sessionId?: string;
}

export interface ChatMessageResponse {
  messageId: string;
  content: string;
  userId: string;
  username: string;
  timestamp: Date;
  sessionId: string;
  isEcho: boolean;
}

export interface SystemNotification {
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  timestamp: Date;
}

export interface CommunicationService {
  /**
   * Sends an authentication response
   */
  sendAuthenticationResponse(
    connectionId: ConnectionId,
    response: AuthenticationResponse
  ): Promise<boolean>;

  /**
   * Sends a chat message response
   */
  sendChatMessageResponse(
    connectionId: ConnectionId,
    response: ChatMessageResponse
  ): Promise<boolean>;

  /**
   * Sends a system notification
   */
  sendSystemNotification(
    connectionId: ConnectionId,
    notification: SystemNotification
  ): Promise<boolean>;

  /**
   * Sends a generic message
   */
  sendMessage(
    connectionId: ConnectionId,
    message: CommunicationMessage
  ): Promise<boolean>;

  /**
   * Disconnects a connection gracefully
   */
  disconnect(connectionId: ConnectionId, reason?: string): Promise<void>;

  /**
   * Checks if a connection is active
   */
  isConnectionActive(connectionId: ConnectionId): Promise<boolean>;

  /**
   * Performs cleanup operations
   */
  cleanup(): void;
}
