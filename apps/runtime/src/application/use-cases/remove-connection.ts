import { logger } from '@awslambdahackathon/utils/lambda';

import { ConnectionService } from '../../services/connection-service.js';

export async function removeConnection(
  connectionService: ConnectionService,
  connectionId: string
): Promise<void> {
  logger.info('Removing connection', { connectionId });
  await connectionService.removeConnection(connectionId);
}
