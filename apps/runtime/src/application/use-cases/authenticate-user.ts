import { logger } from '@awslambdahackathon/utils/lambda';
import {
  AuthenticationResult,
  AuthenticationService,
} from '@domain/services/authentication-service';

interface AuthenticateUserResult {
  success: boolean;
  user?: AuthenticationResult['user'];
  error?: string;
}

export async function authenticateUser(
  authenticationService: AuthenticationService,
  token: string
): Promise<AuthenticateUserResult> {
  try {
    logger.info('Authenticating user', { tokenLength: token?.length });
    const result = await authenticationService.authenticateUser({ token });

    if (result.success) {
      return {
        success: true,
        user: result.user,
      };
    } else {
      return {
        success: false,
        error: result.error,
      };
    }
  } catch (error) {
    logger.error('Authentication failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      tokenLength: token?.length,
    });

    return {
      success: false,
      error: 'Authentication failed',
    };
  }
}
