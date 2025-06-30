import { BaseRequestDto } from '../../../shared/dto/base/base-request.dto';

/**
 * DTO for authentication requests
 */
export interface AuthRequestDto extends BaseRequestDto {
  /** JWT token for authentication */
  token: string;

  /** WebSocket connection ID (optional) */
  connectionId?: string;

  /** Client information */
  clientInfo?: {
    /** User agent string */
    userAgent?: string;

    /** IP address */
    ipAddress?: string;

    /** Client platform */
    platform?: string;

    /** Client version */
    version?: string;
  };
}

/**
 * DTO for token refresh requests
 */
export interface RefreshTokenRequestDto extends BaseRequestDto {
  /** Refresh token */
  refreshToken: string;

  /** Current access token (optional) */
  accessToken?: string;
}

/**
 * DTO for logout requests
 */
export interface LogoutRequestDto extends BaseRequestDto {
  /** Connection ID to logout */
  connectionId?: string;

  /** Whether to logout from all devices */
  logoutAll?: boolean;
}
