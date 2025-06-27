import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import { logger } from '@awslambdahackathon/utils/lambda';

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

export async function storeConnection(connectionId: string): Promise<void> {
  const now = new Date();
  const connection = {
    connectionId,
    timestamp: now.toISOString(),
    ttl: Math.floor(now.getTime() / 1000) + 2 * 60 * 60, // 2 hours TTL
  };
  logger.info('Storing connection in DynamoDB', { connection });
  await ddbDocClient.send(
    new PutCommand({
      TableName: process.env.WEBSOCKET_CONNECTIONS_TABLE,
      Item: connection,
    })
  );
  logger.info('Connection stored successfully', { connectionId });
}
