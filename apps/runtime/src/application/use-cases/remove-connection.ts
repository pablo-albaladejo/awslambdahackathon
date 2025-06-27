import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { logger } from '@awslambdahackathon/utils/lambda';

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

export async function removeConnection(connectionId: string): Promise<void> {
  logger.info('Removing connection from DynamoDB', { connectionId });
  await ddbDocClient.send(
    new DeleteCommand({
      TableName: process.env.WEBSOCKET_CONNECTIONS_TABLE,
      Key: { connectionId },
    })
  );
  logger.info('Connection removed from DynamoDB', { connectionId });
}
