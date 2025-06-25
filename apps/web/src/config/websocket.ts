import { logger } from '@awslambdahackathon/utils/frontend';
import { fetchAuthSession } from 'aws-amplify/auth';

export interface WebSocketMessage {
  action: string;
  message?: string;
  sessionId?: string;
}

export interface WebSocketResponse {
  message: string;
  sessionId: string;
  timestamp: string;
  isEcho: boolean;
}

class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private url: string;

  constructor() {
    this.url = import.meta.env.VITE_WEBSOCKET_URL || 'wss://localhost:3001';
  }

  async connect(): Promise<void> {
    try {
      const session = await fetchAuthSession();
      logger.info('Auth session fetched', {
        hasIdToken: !!session.tokens?.idToken,
        hasAccessToken: !!session.tokens?.accessToken,
        accessTokenPayload: session.tokens?.accessToken?.payload,
      });

      const token = session.tokens?.accessToken?.toString();

      if (!token) {
        throw new Error('No authentication token available');
      }

      logger.info('Connecting to WebSocket', {
        url: this.url,
        tokenLength: token.length,
        tokenStart: token.substring(0, 10) + '...',
      });

      // Ensure the token is properly encoded
      const encodedToken = encodeURIComponent(token);
      this.ws = new WebSocket(`${this.url}?Authorization=${encodedToken}`);

      this.ws.onopen = () => {
        logger.info('WebSocket connected successfully');
        this.reconnectAttempts = 0;
      };

      this.ws.onclose = event => {
        logger.info('WebSocket disconnected', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
        });
        this.attemptReconnect();
      };

      this.ws.onerror = error => {
        logger.error('WebSocket error', {
          error,
          readyState: this.ws?.readyState,
          url: this.ws?.url,
        });
      };
    } catch (error) {
      logger.error('Error connecting to WebSocket', {
        error,
        url: this.url,
      });
      throw error;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      logger.info('Attempting to reconnect WebSocket', {
        attempt: this.reconnectAttempts,
      });

      setTimeout(() => {
        this.connect().catch(error => {
          logger.error('Reconnection failed', {
            error,
            attempt: this.reconnectAttempts,
          });
        });
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      logger.error('Max reconnection attempts reached');
    }
  }

  sendMessage(message: string, sessionId?: string): Promise<WebSocketResponse> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'));
        return;
      }

      const wsMessage: WebSocketMessage = {
        action: 'sendMessage',
        message,
        sessionId,
      };

      this.ws.send(JSON.stringify(wsMessage));

      // Set up a one-time message listener for the response
      const messageHandler = (event: MessageEvent) => {
        try {
          const response: WebSocketResponse = JSON.parse(event.data);
          this.ws?.removeEventListener('message', messageHandler);
          resolve(response);
        } catch (error) {
          this.ws?.removeEventListener('message', messageHandler);
          reject(error);
        }
      };

      this.ws.addEventListener('message', messageHandler);

      // Set a timeout for the response
      setTimeout(() => {
        this.ws?.removeEventListener('message', messageHandler);
        reject(new Error('WebSocket message timeout'));
      }, 10000);
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const websocketClient = new WebSocketClient();

export const websocketConfig = {
  url: import.meta.env.VITE_WEBSOCKET_URL || 'wss://localhost:3001',
  reconnectInterval: 3000,
  maxReconnectAttempts: 5,
};
