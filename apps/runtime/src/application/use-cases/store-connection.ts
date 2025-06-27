import { logger } from '@awslambdahackathon/utils/lambda';

import { ConnectionService } from '../../services/connection-service.js';

export async function storeConnection(
  connectionService: ConnectionService,
  connectionId: string
): Promise<void> {
  logger.info('Storing connection', { connectionId });
  await connectionService.storeConnection(connectionId);
}
