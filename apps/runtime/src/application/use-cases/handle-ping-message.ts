import { logger } from '@awslambdahackathon/utils/lambda';

interface HandlePingMessageResult {
  success: boolean;
  error?: string;
}

export async function handlePingMessage(
  connectionId: string
): Promise<HandlePingMessageResult> {
  try {
    logger.info('Received ping message', { connectionId });
    // Optionally, add domain logic here if needed
    // For example, update connection activity timestamp

    return { success: true };
  } catch (error) {
    logger.error('Failed to handle ping message', {
      error: error instanceof Error ? error.message : 'Unknown error',
      connectionId,
    });

    return {
      success: false,
      error: 'Failed to handle ping message',
    };
  }
}
