import { logger } from '@awslambdahackathon/utils/lambda';
import { ConnectionId } from '@domain/value-objects';

import type { ConnectionService } from '@/application/services/connection-service';

interface RemoveConnectionResult {
  success: boolean;
  error?: string;
}

export async function removeConnection(
  connectionService: ConnectionService,
  connectionId: string
): Promise<RemoveConnectionResult> {
  try {
    logger.info('Removing connection', { connectionId });
    await connectionService.removeConnection({
      connectionId: ConnectionId.create(connectionId),
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to remove connection', {
      error: error instanceof Error ? error.message : 'Unknown error',
      connectionId,
    });

    return {
      success: false,
      error: 'Failed to remove connection',
    };
  }
}
