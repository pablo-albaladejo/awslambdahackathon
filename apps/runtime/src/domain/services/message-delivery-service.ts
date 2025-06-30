import { ConnectionId, UserId } from '@domain/value-objects';

export interface MessageDeliveryCommand {
  connectionId: ConnectionId;
  content: string;
  messageType?: 'text' | 'system' | 'error';
  metadata?: Record<string, unknown>;
}

export interface BroadcastMessageCommand {
  content: string;
  messageType?: 'text' | 'system' | 'error';
  targetUsers?: UserId[];
  excludeUsers?: UserId[];
  metadata?: Record<string, unknown>;
}

export interface MessageDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  deliveredAt?: Date;
}

export interface MessageDeliveryService {
  /**
   * Delivers a message to a specific connection
   */
  deliverMessage(
    command: MessageDeliveryCommand
  ): Promise<MessageDeliveryResult>;

  /**
   * Broadcasts a message to multiple connections
   */
  broadcastMessage(
    command: BroadcastMessageCommand
  ): Promise<MessageDeliveryResult[]>;

  /**
   * Sends a system notification to a connection
   */
  sendSystemNotification(
    connectionId: ConnectionId,
    content: string
  ): Promise<MessageDeliveryResult>;

  /**
   * Sends an error message to a connection
   */
  sendErrorMessage(
    connectionId: ConnectionId,
    error: string
  ): Promise<MessageDeliveryResult>;

  /**
   * Checks if a connection can receive messages
   */
  canDeliverToConnection(connectionId: ConnectionId): Promise<boolean>;

  /**
   * Gets delivery statistics
   */
  getDeliveryStats(): Promise<{
    totalDelivered: number;
    totalFailed: number;
    activeConnections: number;
  }>;
}
