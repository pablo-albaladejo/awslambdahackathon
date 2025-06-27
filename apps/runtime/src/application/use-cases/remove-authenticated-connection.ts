import { logger } from '@awslambdahackathon/utils/lambda';

import { authenticationService } from '../../services/authentication-service';

export async function removeAuthenticatedConnection(
  connectionId: string
): Promise<void> {
  logger.info('Removing authenticated connection', { connectionId });
  await authenticationService.removeAuthenticatedConnection(connectionId);
  logger.info('Authenticated connection removed', { connectionId });
}
