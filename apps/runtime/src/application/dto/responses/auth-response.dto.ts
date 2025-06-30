import {
  BaseResponseDto,
  ErrorResponseDto,
  SuccessResponseDto,
} from '../../../shared/dto/base/base-response.dto';

/**
 * User information in authentication responses
 */
export interface AuthUserDto {
  /** User ID */
  id: string;

  /** Username */
  username: string;

  /** Email address */
  email: string;

  /** User groups/roles */
  groups: string[];

  /** Whether the user is active */
  isActive: boolean;

  /** Last activity timestamp */
  lastActivityAt: string;
}

/**
 * DTO for successful authentication responses
 */
export interface AuthSuccessResponseDto
  extends SuccessResponseDto<AuthUserDto> {
  /** Access token (if applicable) */
  accessToken?: string;

  /** Refresh token (if applicable) */
  refreshToken?: string;

  /** Token expiration time */
  expiresAt?: string;

  /** Session ID */
  sessionId?: string;

  /** Connection ID (for WebSocket) */
  connectionId?: string;
}

/**
 * DTO for failed authentication responses
 */
export interface AuthErrorResponseDto extends ErrorResponseDto {
  /** Specific authentication error code */
  authErrorCode?:
    | 'INVALID_TOKEN'
    | 'EXPIRED_TOKEN'
    | 'INSUFFICIENT_PERMISSIONS'
    | 'USER_INACTIVE'
    | 'UNKNOWN';

  /** Whether the user should retry */
  retryable?: boolean;

  /** Suggested action for the client */
  suggestedAction?: 'REFRESH_TOKEN' | 'LOGIN_AGAIN' | 'CONTACT_SUPPORT';
}

/**
 * Union type for all authentication responses
 */
export type AuthResponseDto = AuthSuccessResponseDto | AuthErrorResponseDto;

/**
 * DTO for token refresh responses
 */
export interface RefreshTokenResponseDto extends BaseResponseDto {
  /** New access token */
  accessToken?: string;

  /** New refresh token */
  refreshToken?: string;

  /** Token expiration time */
  expiresAt?: string;
}

/**
 * DTO for logout responses
 */
export interface LogoutResponseDto extends BaseResponseDto {
  /** Number of sessions terminated */
  sessionsTerminated?: number;

  /** Whether all devices were logged out */
  allDevicesLoggedOut?: boolean;
}
