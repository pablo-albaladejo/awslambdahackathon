import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

export class ConnectionService {
  private readonly tableName = process.env.WEBSOCKET_CONNECTIONS_TABLE!;

  async storeConnection(connectionId: string): Promise<void> {
    const now = new Date();
    const connection = {
      connectionId,
      timestamp: now.toISOString(),
      ttl: Math.floor(now.getTime() / 1000) + 2 * 60 * 60, // 2 hours TTL
    };
    await ddbDocClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: connection,
      })
    );
  }

  async removeConnection(connectionId: string): Promise<void> {
    await ddbDocClient.send(
      new DeleteCommand({
        TableName: this.tableName,
        Key: { connectionId },
      })
    );
  }
}
