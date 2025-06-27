import { logger } from '@awslambdahackathon/utils/lambda';

import type { AuthenticationResult } from '../../services/authentication-service';
import { authenticationService } from '../../services/authentication-service';

export async function authenticateUser(
  token: string
): Promise<AuthenticationResult> {
  logger.info('Authenticating user', { tokenLength: token?.length });
  return authenticationService.authenticateUser(token);
}
