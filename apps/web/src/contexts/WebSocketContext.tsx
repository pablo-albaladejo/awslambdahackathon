import { fetchAuthSession } from '@aws-amplify/auth';
import { logger } from '@awslambdahackathon/utils/frontend';
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

export interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  sessionId?: string;
}

interface WebSocketState {
  messages: Message[];
  isConnected: boolean;
  isLoading: boolean;
  sessionId?: string;
  sendMessage: (text: string) => Promise<void>;
}

const initialState: WebSocketState = {
  messages: [],
  isConnected: false,
  isLoading: false,
  sessionId: undefined,
  sendMessage: async () => {},
};

export const WebSocketContext = createContext<WebSocketState>(initialState);

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
}) => {
  const [state, setState] = useState<WebSocketState>(initialState);
  const websocketBaseUrl =
    import.meta.env.VITE_WEBSOCKET_URL || 'wss://localhost:3001';

  useEffect(() => {
    let ws: WebSocket | null = null;

    const connect = async () => {
      try {
        const session = await fetchAuthSession();
        const token = session.tokens?.accessToken.toString();

        if (!token) {
          throw new Error('JWT token not available. Please log in again.');
        }

        logger.info('Connecting to WebSocket', {
          url: websocketBaseUrl,
          tokenLength: token.length,
          tokenStart: token.substring(0, 10) + '...',
        });

        const websocketUrl = `${websocketBaseUrl}?Authorization=${encodeURIComponent(token)}`;
        ws = new WebSocket(websocketUrl);

        ws.onopen = () => {
          logger.info('WebSocket connected successfully');
          setState(prev => ({
            ...prev,
            isConnected: true,
            messages: [
              ...prev.messages,
              {
                id: Date.now().toString(),
                text: 'Connected to chatbot',
                isUser: false,
                timestamp: new Date(),
              },
            ],
            sendMessage: async (text: string) => {
              if (ws?.readyState !== WebSocket.OPEN) {
                throw new Error('WebSocket is not connected');
              }

              const message = {
                action: 'sendMessage',
                message: text,
                sessionId: state.sessionId,
              };

              ws.send(JSON.stringify(message));
              setState(prev => ({
                ...prev,
                messages: [
                  ...prev.messages,
                  {
                    id: Date.now().toString(),
                    text,
                    isUser: true,
                    timestamp: new Date(),
                    sessionId: state.sessionId,
                  },
                ],
                isLoading: true,
              }));
            },
          }));
        };

        ws.onclose = event => {
          logger.info('WebSocket disconnected', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          });
          setState(prev => ({
            ...prev,
            isConnected: false,
            messages: [
              ...prev.messages,
              {
                id: Date.now().toString(),
                text: 'Disconnected from chatbot',
                isUser: false,
                timestamp: new Date(),
              },
            ],
          }));
          setTimeout(connect, 1000);
        };

        ws.onerror = error => {
          logger.error('WebSocket error', {
            error,
            readyState: ws?.readyState,
            url: ws?.url,
          });
        };

        ws.onmessage = event => {
          try {
            const data = JSON.parse(event.data);
            logger.info('Message received', { data });

            setState(prev => ({
              ...prev,
              isLoading: false,
              sessionId: data.sessionId || prev.sessionId,
              messages: [
                ...prev.messages,
                {
                  id: Date.now().toString(),
                  text: data.message,
                  isUser: false,
                  timestamp: new Date(data.timestamp || Date.now()),
                  sessionId: data.sessionId,
                },
              ],
            }));
          } catch (error) {
            logger.error('Error parsing WebSocket message', {
              error,
              data: event.data,
            });
          }
        };
      } catch (error) {
        logger.error('Error connecting to WebSocket', { error });
        setState(prev => ({
          ...prev,
          isConnected: false,
          messages: [
            ...prev.messages,
            {
              id: Date.now().toString(),
              text: 'Error: Could not connect to chatbot',
              isUser: false,
              timestamp: new Date(),
            },
          ],
        }));
      }
    };

    connect();

    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  return (
    <WebSocketContext.Provider value={state}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
