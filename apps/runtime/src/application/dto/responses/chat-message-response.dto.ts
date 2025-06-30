import {
  BaseResponseDto,
  PaginatedResponseDto,
  SuccessResponseDto,
} from '@/shared/dto/base/base-response.dto';

/**
 * Chat message data in responses
 */
export interface ChatMessageDto {
  /** Message ID */
  id: string;

  /** Message content */
  content: string;

  /** Message type */
  type: 'text' | 'system' | 'notification';

  /** User ID who sent the message */
  userId: string;

  /** Username who sent the message */
  username?: string;

  /** Session ID */
  sessionId: string;

  /** Message status */
  status: 'sent' | 'delivered' | 'read' | 'failed';

  /** Creation timestamp */
  createdAt: string;

  /** Reply to message ID (if this is a reply) */
  replyToMessageId?: string;

  /** Message metadata */
  metadata?: Record<string, unknown>;

  /** Whether this is an echo of the sender's own message */
  isEcho?: boolean;
}

/**
 * DTO for successful message send responses
 */
export interface SendChatMessageResponseDto
  extends SuccessResponseDto<ChatMessageDto> {
  /** Whether the message was sent to other participants */
  broadcasted?: boolean;

  /** Number of recipients */
  recipientCount?: number;
}

/**
 * DTO for chat message list responses
 */
export interface GetChatMessagesResponseDto
  extends PaginatedResponseDto<ChatMessageDto> {
  /** Session information */
  session?: {
    /** Session ID */
    id: string;

    /** Session status */
    status: 'active' | 'inactive' | 'expired';

    /** Number of participants */
    participantCount?: number;
  };
}

/**
 * DTO for message status update responses
 */
export interface UpdateMessageStatusResponseDto
  extends SuccessResponseDto<ChatMessageDto> {
  /** Previous status */
  previousStatus?: string;

  /** Timestamp of status change */
  statusChangedAt?: string;
}

/**
 * DTO for message deletion responses
 */
export interface DeleteMessageResponseDto extends BaseResponseDto {
  /** ID of deleted message */
  deletedMessageId?: string;

  /** Timestamp of deletion */
  deletedAt?: string;
}

/**
 * DTO for real-time message notifications (WebSocket)
 */
export interface MessageNotificationDto {
  /** Notification type */
  type:
    | 'new_message'
    | 'message_updated'
    | 'message_deleted'
    | 'typing_indicator';

  /** Message data (for new_message and message_updated) */
  message?: ChatMessageDto;

  /** Message ID (for message_deleted) */
  messageId?: string;

  /** Session ID */
  sessionId: string;

  /** User who triggered the notification */
  triggeredBy?: {
    /** User ID */
    userId: string;

    /** Username */
    username: string;
  };

  /** Timestamp of the notification */
  timestamp: string;

  /** Additional notification data */
  data?: Record<string, unknown>;
}
