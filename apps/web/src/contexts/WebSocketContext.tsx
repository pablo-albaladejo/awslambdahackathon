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
  reconnectFailed: boolean;
  retryConnect: () => void;
}

const initialState: WebSocketState = {
  messages: [],
  isConnected: false,
  isLoading: false,
  sessionId: undefined,
  sendMessage: async () => {},
  error: undefined,
  isReconnecting: false,
  reconnectFailed: false,
  retryConnect: () => {},
};

export const WebSocketContext = createContext<WebSocketState>(initialState);

interface WebSocketProviderProps {
  children: ReactNode;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
}) => {
  const [state, setState] = useState<WebSocketState>(initialState);
  const wsRef = useRef<(WebSocket & { cleanup?: () => void }) | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const reconnectAttemptsRef = useRef(0);
  const isConnectingRef = useRef(false);
  const [token, setToken] = useState<string | null>(null);
  const [reconnectFailed, setReconnectFailed] = useState(false);

  const websocketConfig = getWebSocketConfig();

  const handleError = useCallback(
    (error: string, isReconnecting: boolean = false) => {
      setState(prev => ({
        ...prev,
        error,
        isReconnecting,
        isConnected: false,
      }));
      logger.error('WebSocketProvider error', { error, isReconnecting });
    },
    []
  );

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: undefined }));
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        const error = 'WebSocket is not connected';
        setState(prev => ({ ...prev, error }));
        throw new Error(error);
      }

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
        // Use new standardized message format
        const message = {
          type: 'message' as const,
          data: {
            action: 'sendMessage',
            message: text,
            sessionId: state.sessionId,
          },
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
          error: undefined,
        }));
      } catch (error) {
        const errorMessage = 'Failed to send message';
        setState(prev => ({ ...prev, error: errorMessage }));
        throw new Error(errorMessage);
      }
    },
    [state.sessionId]
  );

  const handleOpen = useCallback(() => {
    const ws = wsRef.current;
    if (!ws || !token) return;
    logger.info('WebSocket connected successfully, sending authentication');
    setState(prev => ({
      ...prev,
      isReconnecting: false,
      error: undefined,
    }));
    reconnectAttemptsRef.current = 0;

    // Use new standardized message format
    const authMessage = {
      type: 'auth' as const,
      data: {
        action: 'authenticate',
        token,
      },
    };
    ws.send(JSON.stringify(authMessage));
  }, [token]);

  const handleClose = useCallback(
    (event: CloseEvent) => {
      logger.info('WebSocket disconnected', {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      });
      wsRef.current = null;
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

      if (reconnectAttemptsRef.current < websocketConfig.reconnectAttempts) {
        const delay = Math.max(
          1000,
          Math.min(
            websocketConfig.reconnectDelay *
              Math.pow(2, reconnectAttemptsRef.current),
            websocketConfig.maxReconnectDelay
          )
        );
        setState(prev => ({ ...prev, isReconnecting: true }));
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          connect();
        }, delay);
        return;
      }
      setReconnectFailed(true);
      handleError(
        'Failed to reconnect after multiple attempts. Please refresh the page or click retry.'
      );
    },
    [websocketConfig, handleError]
  );

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

  const handleMessage = useCallback(
    (event: MessageEvent<string>) => {
      try {
        const validation = webSocketValidation.validateMessage(
          JSON.parse(event.data)
        );
        if (!validation.success || !validation.data) {
          logger.error('Invalid message received:', validation.error);
          return;
        }
        const data = validation.data;
        logger.info('Message received', { data });

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
              data.data.error || 'Authentication failed. Please log in again.';
            handleError(errorMessage);
            wsRef.current?.close();
            reconnectAttemptsRef.current = websocketConfig.reconnectAttempts;
          }
          return;
        }

        if (data.type === 'error') {
          handleError(`Server error: ${data.data.message}`);
          return;
        }

        if (data.type === 'message_response') {
          setState(prev => ({
            ...prev,
            isLoading: false,
            error: undefined,
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
    },
    [handleError, websocketConfig]
  );

  const connect = useCallback(async () => {
    if (isConnectingRef.current) return;
    isConnectingRef.current = true;
    try {
      clearError();
      const session = await fetchAuthSession();
      const tokenValue = session.tokens?.accessToken.toString();
      setToken(tokenValue || null);
      if (!tokenValue) {
        throw new Error('JWT token not available. Please log in again.');
      }
      logger.info('Connecting to WebSocket', {
        url: websocketConfig.url,
        tokenLength: tokenValue.length,
        tokenStart: tokenValue.substring(0, 10) + '...',
      });
      const newWs = new WebSocket(websocketConfig.url);
      newWs.addEventListener('open', handleOpen);
      newWs.addEventListener('close', handleClose);
      newWs.addEventListener('error', handleWebSocketError);
      newWs.addEventListener('message', handleMessage);

      // Guardamos cleanup en el ref
      (newWs as WebSocket & { cleanup: () => void }).cleanup = () => {
        newWs.removeEventListener('open', handleOpen);
        newWs.removeEventListener('close', handleClose);
        newWs.removeEventListener('error', handleWebSocketError);
        newWs.removeEventListener('message', handleMessage);
      };
      wsRef.current = newWs as WebSocket & { cleanup: () => void };
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
  }, [
    websocketConfig,
    handleError,
    clearError,
    handleOpen,
    handleClose,
    handleWebSocketError,
    handleMessage,
  ]);

  useEffect(() => {
    connect();

    return () => {
      // Clear reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      // Cerramos socket si sigue vivo
      const ws = wsRef.current;
      if (ws) {
        ws.cleanup?.();
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      }
    };
  }, [websocketConfig.url, connect]);

  const retryConnect = useCallback(() => {
    setReconnectFailed(false);
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  const contextValue = useMemo(
    () => ({
      ...state,
      sendMessage,
      reconnectFailed,
      retryConnect,
    }),
    [state, sendMessage, reconnectFailed, retryConnect]
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
