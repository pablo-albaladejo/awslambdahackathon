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
  const tokenRef = useRef<string | null>(null);
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

  const handleOpen = useCallback((event?: Event) => {
    const ws = (event?.target as WebSocket) || wsRef.current;
    const tokenToUse = tokenRef.current;
    logger.info('[WebSocket] Open event triggered', {
      hasWs: !!ws,
      hasToken: !!tokenToUse,
      wsReadyState: ws?.readyState,
    });
    if (!ws || !tokenToUse) {
      logger.error('[WebSocket] Cannot send auth message', {
        hasWs: !!ws,
        hasToken: !!tokenToUse,
      });
      return;
    }
    logger.info('[WebSocket] Connected, sending authentication');
    setState(prev => ({
      ...prev,
      isReconnecting: false,
      error: undefined,
    }));
    reconnectAttemptsRef.current = 0;
    const authMessage = {
      type: 'auth' as const,
      data: {
        action: 'authenticate',
        token: tokenToUse,
      },
    };
    logger.info('[WebSocket] Sending auth message', {
      messageType: authMessage.type,
      hasToken: !!authMessage.data.token,
      tokenLength: authMessage.data.token?.length,
    });
    try {
      ws.send(JSON.stringify(authMessage));
      logger.info('[WebSocket] Auth message sent');
    } catch (error) {
      logger.error('[WebSocket] Failed to send auth message', { error });
    }
  }, []);

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
    [
      websocketConfig.reconnectAttempts,
      websocketConfig.reconnectDelay,
      websocketConfig.maxReconnectDelay,
      handleError,
    ]
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
      logger.info('[WebSocket] Message received from server', {
        raw: event.data,
      });
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
    [handleError, websocketConfig.reconnectAttempts]
  );

  const connect = useCallback(async () => {
    if (isConnectingRef.current) return;
    isConnectingRef.current = true;
    try {
      clearError();
      logger.info('[WebSocket] Starting fetchAuthSession...');
      const session = await fetchAuthSession();
      const tokenValue = session.tokens?.accessToken.toString();
      logger.info('[WebSocket] Token obtained', {
        tokenLength: tokenValue?.length,
        tokenStart: tokenValue?.substring(0, 10) + '...',
      });
      tokenRef.current = tokenValue || null;
      if (!tokenValue) {
        logger.error('[WebSocket] JWT token not available');
        throw new Error('JWT token not available. Please log in again.');
      }
      logger.info('[WebSocket] Connecting to WebSocket', {
        url: websocketConfig.url,
        tokenLength: tokenValue.length,
        tokenStart: tokenValue.substring(0, 10) + '...',
      });
      const newWs = new WebSocket(websocketConfig.url);
      wsRef.current = newWs as WebSocket & { cleanup: () => void };
      newWs.addEventListener('open', handleOpen);
      newWs.addEventListener('close', handleClose);
      newWs.addEventListener('error', handleWebSocketError);
      newWs.addEventListener('message', handleMessage);
      (newWs as WebSocket & { cleanup: () => void }).cleanup = () => {
        newWs.removeEventListener('open', handleOpen);
        newWs.removeEventListener('close', handleClose);
        newWs.removeEventListener('error', handleWebSocketError);
        newWs.removeEventListener('message', handleMessage);
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Could not connect to chatbot';
      logger.error('[WebSocket] Error connecting', { error });
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
    websocketConfig.url,
    handleError,
    clearError,
    handleOpen,
    handleClose,
    handleWebSocketError,
    handleMessage,
  ]);

  useEffect(() => {
    const fetchToken = async () => {
      connect();
    };
    fetchToken();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  const retryConnect = useCallback(() => {
    setReconnectFailed(false);
    reconnectAttemptsRef.current = 0;
    isConnectingRef.current = false;
    logger.info(
      'Manual retry triggered: resetting reconnect state and calling connect()'
    );
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
