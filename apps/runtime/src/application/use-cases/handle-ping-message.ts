import { logger } from '@awslambdahackathon/utils/lambda';

export async function handlePingMessage(connectionId: string): Promise<void> {
  logger.info('Received ping message', { connectionId });
}
