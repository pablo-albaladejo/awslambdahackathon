import { logger } from '@awslambdahackathon/utils/lambda';
import type { ConnectionService } from '@domain/services/connection-service';
import { ConnectionId } from '@domain/value-objects';

interface StoreConnectionResult {
  success: boolean;
  error?: string;
}

export async function storeConnection(
  connectionService: ConnectionService,
  connectionId: string
): Promise<StoreConnectionResult> {
  try {
    logger.info('Storing connection', { connectionId });
    await connectionService.storeConnection({
      connectionId: ConnectionId.create(connectionId),
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to store connection', {
      error: error instanceof Error ? error.message : 'Unknown error',
      connectionId,
    });

    return {
      success: false,
      error: 'Failed to store connection',
    };
  }
}
