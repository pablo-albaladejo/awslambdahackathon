import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

import { authenticationService } from './authentication-service';

const ddbClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(ddbClient);

export class ChatService {
  async storeAndEchoMessage({
    connectionId,
    message,
    sessionId,
  }: {
    connectionId: string;
    message: string;
    sessionId?: string;
  }): Promise<{ message: string; sessionId: string }> {
    if (typeof message !== 'string')
      throw new Error('Message must be a string');
    const user =
      await authenticationService.getUserFromConnection(connectionId);
    if (!user) throw new Error('User not found for authenticated connection');
    const now = new Date();
    const currentSessionId =
      sessionId ||
      `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const userMessage = {
      message,
      sessionId: currentSessionId,
      timestamp: now.toISOString(),
    };
    await ddbDocClient.send(
      new PutCommand({
        TableName: process.env.WEBSOCKET_MESSAGES_TABLE,
        Item: {
          ...userMessage,
          ttl: Math.floor(now.getTime() / 1000) + 24 * 60 * 60,
          type: 'user',
          connectionId,
          userId: user.userId,
        },
      })
    );
    // Echo the message back as bot
    const botMessage = {
      message,
      sessionId: currentSessionId,
      timestamp: new Date().toISOString(),
    };
    await ddbDocClient.send(
      new PutCommand({
        TableName: process.env.WEBSOCKET_MESSAGES_TABLE,
        Item: {
          ...botMessage,
          ttl: Math.floor(now.getTime() / 1000) + 24 * 60 * 60,
          type: 'bot',
          connectionId,
          userId: user.userId,
        },
      })
    );
    return { message, sessionId: currentSessionId };
  }
}

export const chatService = new ChatService();
