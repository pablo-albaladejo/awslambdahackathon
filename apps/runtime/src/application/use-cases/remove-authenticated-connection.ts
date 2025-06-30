import { logger } from '@awslambdahackathon/utils/lambda';
import type { AuthenticationService } from '@domain/services/authentication-service';
import { ConnectionId } from '@domain/value-objects';

interface RemoveAuthenticatedConnectionResult {
  success: boolean;
  error?: string;
}

export async function removeAuthenticatedConnection(
  authenticationService: AuthenticationService,
  connectionId: string
): Promise<RemoveAuthenticatedConnectionResult> {
  try {
    logger.info('Removing authenticated connection', { connectionId });
    await authenticationService.removeAuthenticatedConnection(
      ConnectionId.create(connectionId)
    );
    logger.info('Authenticated connection removed', { connectionId });

    return { success: true };
  } catch (error) {
    logger.error('Failed to remove authenticated connection', {
      error: error instanceof Error ? error.message : 'Unknown error',
      connectionId,
    });

    return {
      success: false,
      error: 'Failed to remove authenticated connection',
    };
  }
}
