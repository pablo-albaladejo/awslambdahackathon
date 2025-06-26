import { fetchAuthSession } from '@aws-amplify/auth';
import { logger } from '@awslambdahackathon/utils/frontend';
import React, {
  createContext,
  ReactNode,
  useCallback,
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
  error?: string;
  isReconnecting: boolean;
}

const initialState: WebSocketState = {
  messages: [],
  isConnected: false,
  isLoading: false,
  sessionId: undefined,
  sendMessage: async () => {},
  error: undefined,
  isReconnecting: false,
};

export const WebSocketContext = createContext<WebSocketState>(initialState);

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
}) => {
  const [state, setState] = useState<WebSocketState>(initialState);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const websocketBaseUrl =
    import.meta.env.VITE_WEBSOCKET_URL || 'wss://localhost:3001';

  // Create a stable sendMessage function using useCallback
  const sendMessage = useCallback(
    async (text: string) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        const error = 'WebSocket is not connected';
        setState(prev => ({ ...prev, error }));
        throw new Error(error);
      }

      const message = {
        action: 'sendMessage',
        message: text,
        sessionId: state.sessionId,
      };

      try {
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
          error: undefined, // Clear any previous errors
        }));
      } catch (error) {
        const errorMessage = 'Failed to send message';
        setState(prev => ({ ...prev, error: errorMessage }));
        throw new Error(errorMessage);
      }
    },
    [ws, state.sessionId]
  );

  // Error handling utility
  const handleError = useCallback(
    (error: string, isReconnecting: boolean = false) => {
      setState(prev => ({
        ...prev,
        error,
        isReconnecting,
        isConnected: false,
      }));

      logger.error('WebSocket error', { error, isReconnecting });
    },
    []
  );

  // Clear error utility
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: undefined }));
  }, []);

  useEffect(() => {
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const connect = async () => {
      try {
        clearError();

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

        // Connect without token in URL for security (Post-Connection Auth)
        const websocketUrl = websocketBaseUrl;
        const newWs = new WebSocket(websocketUrl);

        newWs.onopen = () => {
          logger.info(
            'WebSocket connected successfully, sending authentication'
          );
          setWs(newWs);
          setState(prev => ({
            ...prev,
            isReconnecting: false,
            error: undefined,
          }));

          // Send authentication token as first message
          const authMessage = {
            action: 'authenticate',
            token: token,
          };

          newWs.send(JSON.stringify(authMessage));
        };

        newWs.onclose = event => {
          logger.info('WebSocket disconnected', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
          });

          setWs(null);
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

          // Implement exponential backoff for reconnection
          if (reconnectAttempts < maxReconnectAttempts) {
            const delay = Math.min(
              1000 * Math.pow(2, reconnectAttempts),
              30000
            );
            setState(prev => ({ ...prev, isReconnecting: true }));

            reconnectTimeout = setTimeout(() => {
              reconnectAttempts++;
              connect();
            }, delay);
          } else {
            handleError(
              'Failed to reconnect after multiple attempts. Please refresh the page.'
            );
          }
        };

        newWs.onerror = error => {
          logger.error('WebSocket error', {
            error,
            readyState: newWs?.readyState,
            url: newWs?.url,
          });

          handleError('Connection error occurred');
        };

        newWs.onmessage = event => {
          try {
            const data = JSON.parse(event.data);
            logger.info('Message received', { data });

            // Handle authentication response
            if (data.type === 'auth') {
              if (data.success) {
                setState(prev => ({
                  ...prev,
                  isConnected: true,
                  error: undefined,
                  messages: [
                    ...prev.messages,
                    {
                      id: Date.now().toString(),
                      text: 'Connected to chatbot',
                      isUser: false,
                      timestamp: new Date(),
                    },
                  ],
                }));
                logger.info('WebSocket authentication successful');
              } else {
                const errorMessage =
                  data.error || 'Authentication failed. Please log in again.';
                handleError(errorMessage);
                newWs.close();
              }
              return;
            }

            // Handle error messages
            if (data.type === 'error') {
              handleError(`Server error: ${data.error}`);
              return;
            }

            // Handle regular chat messages
            setState(prev => ({
              ...prev,
              isLoading: false,
              error: undefined, // Clear errors on successful message
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
            handleError('Failed to parse server message');
          }
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : 'Could not connect to chatbot';
        handleError(errorMessage);

        setState(prev => ({
          ...prev,
          isConnected: false,
          messages: [
            ...prev.messages,
            {
              id: Date.now().toString(),
              text: `Error: ${errorMessage}`,
              isUser: false,
              timestamp: new Date(),
            },
          ],
        }));
      }
    };

    connect();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [websocketBaseUrl, handleError, clearError]);

  // Update state with the stable sendMessage function
  useEffect(() => {
    setState(prev => ({
      ...prev,
      sendMessage,
    }));
  }, [sendMessage]);

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
