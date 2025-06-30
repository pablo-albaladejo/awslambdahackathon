import {
  BaseRequestDto,
  FilteredRequestDto,
  PaginatedRequestDto,
} from '../../../shared/dto/base/base-request.dto';

/**
 * DTO for sending chat messages
 */
export interface SendChatMessageRequestDto extends BaseRequestDto {
  /** Message content */
  content: string;

  /** Session ID */
  sessionId: string;

  /** User ID (usually from authentication context) */
  userId: string;

  /** Connection ID (for WebSocket responses) */
  connectionId?: string;

  /** Message type */
  type?: 'text' | 'system' | 'notification';

  /** Reply to message ID (for threaded conversations) */
  replyToMessageId?: string;

  /** Additional message metadata */
  messageMetadata?: Record<string, unknown>;
}

/**
 * DTO for retrieving chat messages
 */
export interface GetChatMessagesRequestDto
  extends PaginatedRequestDto,
    FilteredRequestDto {
  /** Session ID to get messages for */
  sessionId: string;

  /** User ID (for authorization) */
  userId: string;

  /** Message types to include */
  messageTypes?: ('text' | 'system' | 'notification')[];

  /** Date range filter */
  dateRange?: {
    /** Start date (ISO string) */
    from?: string;

    /** End date (ISO string) */
    to?: string;
  };

  /** Whether to include message metadata */
  includeMetadata?: boolean;
}

/**
 * DTO for updating message status
 */
export interface UpdateMessageStatusRequestDto extends BaseRequestDto {
  /** Message ID */
  messageId: string;

  /** New status */
  status: 'sent' | 'delivered' | 'read' | 'failed';

  /** User ID (for authorization) */
  userId: string;
}

/**
 * DTO for deleting messages
 */
export interface DeleteMessageRequestDto extends BaseRequestDto {
  /** Message ID */
  messageId: string;

  /** User ID (for authorization) */
  userId: string;

  /** Reason for deletion */
  reason?: string;
}
