import { logger } from '@awslambdahackathon/utils/lambda';
import { ConnectionId } from '@domain/value-objects';

import type { AuthenticationService } from '@/application/services/authentication-service';

interface CheckAuthenticatedConnectionResult {
  success: boolean;
  isAuthenticated?: boolean;
  error?: string;
}

export async function isConnectionAuthenticated(
  authenticationService: AuthenticationService,
  connectionId: string
): Promise<CheckAuthenticatedConnectionResult> {
  try {
    logger.info('Checking if connection is authenticated', { connectionId });
    const isAuthenticated =
      await authenticationService.isConnectionAuthenticated(
        ConnectionId.create(connectionId)
      );

    return {
      success: true,
      isAuthenticated,
    };
  } catch (error) {
    logger.error('Failed to check connection authentication', {
      error: error instanceof Error ? error.message : 'Unknown error',
      connectionId,
    });

    return {
      success: false,
      error: 'Failed to check authentication',
    };
  }
}
