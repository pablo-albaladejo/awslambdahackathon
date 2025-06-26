import { fetchAuthSession } from '@aws-amplify/auth';
import { logger } from '@awslambdahackathon/utils/frontend';
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getWebSocketConfig } from '../config/app-config';
import { webSocketValidation } from '../services/validation-service';

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
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);

  // Get WebSocket configuration from centralized config
  const websocketConfig = getWebSocketConfig();

  // Memoized error handling utility
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

  // Memoized clear error utility
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: undefined }));
  }, []);

  // Memoized send message function with validation
  const sendMessage = useCallback(
    async (text: string) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        const error = 'WebSocket is not connected';
        setState(prev => ({ ...prev, error }));
        throw new Error(error);
      }

      // Validate message before sending
      const validation = webSocketValidation.validateCompleteMessage(
        text,
        state.sessionId
      );
      if (!validation.success) {
        const errorMessage = validation.error || 'Message validation failed';
        setState(prev => ({ ...prev, error: errorMessage }));
        throw new Error(errorMessage);
      }

      try {
        // Send the validated message
        ws.send(JSON.stringify(validation.data));

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

  // Memoized connection function
  const connect = useCallback(async () => {
    if (isConnectingRef.current) return;
    isConnectingRef.current = true;

    try {
      clearError();

      const session = await fetchAuthSession();
      const token = session.tokens?.accessToken.toString();

      if (!token) {
        throw new Error('JWT token not available. Please log in again.');
      }

      logger.info('Connecting to WebSocket', {
        url: websocketConfig.url,
        tokenLength: token.length,
        tokenStart: token.substring(0, 10) + '...',
      });

      // Connect without token in URL for security (Post-Connection Auth)
      const newWs = new WebSocket(websocketConfig.url);

      // Memoized event handlers to prevent recreation
      const handleOpen = useCallback(() => {
        logger.info('WebSocket connected successfully, sending authentication');
        setWs(newWs);
        setState(prev => ({
          ...prev,
          isReconnecting: false,
          error: undefined,
        }));

        // Send authentication token as first message using validation service
        const authMessage = webSocketValidation.createAuthMessage(token);
        newWs.send(JSON.stringify(authMessage));
      }, [token]);

      const handleClose = useCallback((event: CloseEvent) => {
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

        // Implement exponential backoff for reconnection using config
        if (reconnectAttemptsRef.current < websocketConfig.reconnectAttempts) {
          const delay = Math.min(
            websocketConfig.reconnectDelay *
              Math.pow(2, reconnectAttemptsRef.current),
            websocketConfig.maxReconnectDelay
          );
          setState(prev => ({ ...prev, isReconnecting: true }));

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else {
          handleError(
            'Failed to reconnect after multiple attempts. Please refresh the page.'
          );
        }
      }, []);

      const handleWebSocketError = useCallback((event: Event) => {
        const error = event as ErrorEvent;
        logger.error('WebSocket error:', {
          message: error.message,
          type: error.type,
          error: error.error,
        });

        setState(prev => ({
          ...prev,
          isConnected: false,
          error: `WebSocket error: ${error.message}`,
        }));
      }, []);

      const handleMessage = useCallback((event: MessageEvent<string>) => {
        try {
          // Validate incoming message using validation service
          const validation = webSocketValidation.validateMessage(
            JSON.parse(event.data)
          );

          if (!validation.success || !validation.data) {
            logger.error('Invalid message received:', validation.error);
            return;
          }

          const data = validation.data;
          logger.info('Message received', { data });

          // Handle authentication response
          if (data.type === 'auth_response') {
            if (data.data.success) {
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
                data.data.error ||
                'Authentication failed. Please log in again.';
              handleError(errorMessage);
              newWs.close();
            }
            return;
          }

          // Handle error messages
          if (data.type === 'error') {
            handleError(`Server error: ${data.data.message}`);
            return;
          }

          // Handle regular chat messages
          if (data.type === 'message_response') {
            setState(prev => ({
              ...prev,
              isLoading: false,
              error: undefined, // Clear errors on successful message
              sessionId: data.data.sessionId || prev.sessionId,
              messages: [
                ...prev.messages,
                {
                  id: data.data.messageId,
                  text: data.data.message,
                  isUser: false,
                  timestamp: new Date(data.data.timestamp),
                  sessionId: data.data.sessionId,
                },
              ],
            }));
          }
        } catch (error) {
          logger.error('Error parsing WebSocket message', {
            error,
            data: event.data,
          });
          handleError('Failed to parse server message');
        }
      }, []);

      // Add event listeners
      newWs.addEventListener('open', handleOpen);
      newWs.addEventListener('close', handleClose);
      newWs.addEventListener('error', handleWebSocketError);
      newWs.addEventListener('message', handleMessage);

      // Store cleanup function
      const cleanup = () => {
        newWs.removeEventListener('open', handleOpen);
        newWs.removeEventListener('close', handleClose);
        newWs.removeEventListener('error', handleWebSocketError);
        newWs.removeEventListener('message', handleMessage);
      };

      // Store cleanup function on the WebSocket instance
      (newWs as WebSocket & { cleanup: () => void }).cleanup = cleanup;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Could not connect to chatbot';
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
    } finally {
      isConnectingRef.current = false;
    }
  }, [websocketConfig, handleError, clearError]);

  // Effect for initial connection
  useEffect(() => {
    connect();

    // Cleanup function
    return () => {
      // Clear any pending reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Close WebSocket connection and cleanup listeners
      if (ws) {
        // Call cleanup function if it exists
        if ((ws as WebSocket & { cleanup?: () => void }).cleanup) {
          (ws as WebSocket & { cleanup: () => void }).cleanup();
        }

        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      }
    };
  }, [connect, ws]);

  // Memoized state with sendMessage function
  const contextValue = useMemo(
    () => ({
      ...state,
      sendMessage,
    }),
    [state, sendMessage]
  );

  return (
    <WebSocketContext.Provider value={contextValue}>
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
