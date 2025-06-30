import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { container } from '@config/container';

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

    // Use circuit breaker for DynamoDB connection storage
    await container.getCircuitBreakerService().execute(
      'dynamodb',
      'storeConnection',
      async () => {
        return await ddbDocClient.send(
          new PutCommand({
            TableName: this.tableName,
            Item: connection,
          })
        );
      },
      async () => {
        // Fallback behavior when DynamoDB is unavailable
        throw new Error('Database temporarily unavailable');
      },
      {
        failureThreshold: 3,
        recoveryTimeout: 20000, // 20 seconds
        expectedResponseTime: 500, // 500ms
        monitoringWindow: 60000, // 1 minute
        minimumRequestCount: 5,
      }
    );
  }

  async removeConnection(connectionId: string): Promise<void> {
    // Use circuit breaker for DynamoDB connection removal
    await container.getCircuitBreakerService().execute(
      'dynamodb',
      'removeConnection',
      async () => {
        return await ddbDocClient.send(
          new DeleteCommand({
            TableName: this.tableName,
            Key: { connectionId },
          })
        );
      },
      async () => {
        // Fallback behavior when DynamoDB is unavailable
        throw new Error('Database temporarily unavailable');
      },
      {
        failureThreshold: 3,
        recoveryTimeout: 20000, // 20 seconds
        expectedResponseTime: 500, // 500ms
        monitoringWindow: 60000, // 1 minute
        minimumRequestCount: 5,
      }
    );
  }
}
