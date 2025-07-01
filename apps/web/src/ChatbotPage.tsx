import { logger } from '@awslambdahackathon/utils/frontend';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useWebSocket } from './contexts/WebSocketContext';
import { useCurrentUser } from './hooks/useCurrentUser';
import { usePerformance } from './hooks/usePerformance';
import { useRumTracking } from './hooks/useRumTracking';

import './App.css';
import './index.css';

// Memoized Message Component
const MessageItem = React.memo<{
  message: {
    id: string;
    text: string;
    isUser: boolean;
    timestamp: Date;
    sessionId?: string;
  };
}>(({ message }) => {
  const messageTime = useMemo(
    () => message.timestamp.toLocaleTimeString(),
    [message.timestamp]
  );

  return (
    <div
      className={`chatbot-message-bubble ${message.isUser ? 'user' : 'bot'}`}
    >
      <span className="chatbot-message-text">{message.text}</span>
      <span className="chatbot-message-time">{messageTime}</span>
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

// Memoized Loading Indicator
const LoadingIndicator = React.memo(() => (
  <div className="chatbot-message-bubble bot">
    <div className="flex items-center space-x-2">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
        <div
          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
          style={{ animationDelay: '0.1s' }}
        ></div>
        <div
          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
          style={{ animationDelay: '0.2s' }}
        ></div>
      </div>
      <span className="text-sm text-gray-500">AI is thinking...</span>
    </div>
  </div>
));

LoadingIndicator.displayName = 'LoadingIndicator';

// Memoized Error Banner
const ErrorBanner = React.memo<{
  error: string;
  isReconnecting: boolean;
  onRetry: () => void;
}>(({ error, isReconnecting, onRetry }) => (
  <div className="bg-red-50 border-l-4 border-red-400 p-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center">
        <svg
          className="w-5 h-5 text-red-400 mr-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <span className="text-red-700">{error}</span>
      </div>

      {!isReconnecting && (
        <button
          onClick={onRetry}
          className="text-red-700 hover:text-red-900 text-sm font-medium underline"
        >
          Retry
        </button>
      )}
    </div>
  </div>
));

ErrorBanner.displayName = 'ErrorBanner';

// Memoized Welcome Message
const WelcomeMessage = React.memo(() => (
  <div className="text-center text-gray-500 mt-8">
    <svg
      className="mx-auto h-12 w-12 text-gray-400 mb-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
    <p>Start a conversation with the AI chatbot</p>
  </div>
));

WelcomeMessage.displayName = 'WelcomeMessage';

// Memoized Connection Status
const ConnectionStatus = React.memo<{
  isConnected: boolean;
  isReconnecting: boolean;
}>(({ isConnected, isReconnecting }) => (
  <div className="chatbot-connection-indicator">
    <div
      className={`status-dot ${
        isConnected
          ? 'connected'
          : isReconnecting
            ? 'reconnecting'
            : 'disconnected'
      }`}
    />
    <span className="chatbot-connection-text">
      {isConnected
        ? 'Connected'
        : isReconnecting
          ? 'Reconnecting...'
          : 'Disconnected'}
    </span>
  </div>
));

ConnectionStatus.displayName = 'ConnectionStatus';

const ChatbotPage = React.memo(() => {
  const { user } = useCurrentUser();
  const {
    messages,
    isConnected,
    isLoading,
    sendMessage,
    error,
    isReconnecting,
    sessionId,
  } = useWebSocket();
  const { recordAction } = useRumTracking();
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Performance monitoring for the main component
  const { getPerformanceStats } = usePerformance('ChatbotPage');

  // Memoized user info
  const userInfo = useMemo(
    () => ({
      userId: user?.attributes?.sub || user?.email,
      username: user?.email || 'User',
    }),
    [user?.attributes?.sub, user?.email]
  );

  // Memoized placeholder text
  const placeholderText = useMemo(() => {
    if (!isConnected) return 'Connecting...';
    if (isSending) return 'Sending...';
    return 'Type your message...';
  }, [isConnected, isSending]);

  // Memoized should show welcome
  const shouldShowWelcome = useMemo(
    () => messages.length === 0 && !error,
    [messages.length, error]
  );

  // Memoized is form disabled
  const isFormDisabled = useMemo(
    () => !inputValue.trim() || !isConnected || isSending,
    [inputValue, isConnected, isSending]
  );

  useEffect(() => {
    if (user) {
      recordAction('chatbot_page_viewed', {
        userId: userInfo.userId,
        username: userInfo.username,
      });
    }
  }, [user, recordAction, userInfo]);

  // Log performance stats periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const stats = getPerformanceStats();
      if (stats && stats.slowRenderPercentage > 10) {
        logger.warn('ChatbotPage performance degradation detected', {
          slowRenderPercentage: `${stats.slowRenderPercentage.toFixed(1)}%`,
          averageRenderTime: `${stats.averageRenderTime.toFixed(2)}ms`,
          totalRenders: stats.totalRenders,
        });
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [getPerformanceStats]);

  useEffect(() => {
    // Initialize chat when component mounts
    if (isConnected && !sessionId) {
      // Chat is ready to receive messages
    }
  }, [isConnected, sessionId]);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (messagesContainerRef.current && messages.length > 0) {
      const scrollElement = messagesContainerRef.current;
      const scrollTimeout = setTimeout(() => {
        scrollElement.scrollTop = scrollElement.scrollHeight;
      }, 100);

      return () => clearTimeout(scrollTimeout);
    }
  }, [messages.length]);

  // Focus input on component mount and when connection is established
  useEffect(() => {
    if (isConnected && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isConnected]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!inputValue.trim() || isSending || !isConnected) {
        return;
      }

      const messageText = inputValue.trim();
      setInputValue('');
      setIsSending(true);

      try {
        await sendMessage(messageText);

        recordAction('message_sent', {
          userId: userInfo.userId,
          messageLength: messageText.length,
        });

        logger.info('Message sent successfully', {
          userId: userInfo.userId,
          messageLength: messageText.length,
        });

        // Mantener el foco en el input después de enviar
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to send message';

        logger.error('Failed to send message', {
          error: errorMessage,
          userId: userInfo.userId,
          messageLength: messageText.length,
        });

        recordAction('message_send_error', {
          userId: userInfo.userId,
          error: errorMessage,
        });

        // Show error to user (error state is already handled by WebSocket context)

        // Mantener el foco incluso en caso de error
        setTimeout(() => {
          inputRef.current?.focus();
        }, 0);
      } finally {
        setIsSending(false);
      }
    },
    [inputValue, isSending, isConnected, sendMessage, recordAction, userInfo]
  );

  const handleRetry = useCallback(async () => {
    if (error && !isReconnecting) {
      recordAction('connection_retry', {
        userId: userInfo.userId,
        error: error,
      });

      // The WebSocket context will handle reconnection automatically
      // This is just for user feedback
      logger.info('User initiated connection retry', {
        userId: userInfo.userId,
        error: error,
      });
    }
  }, [error, isReconnecting, recordAction, userInfo]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Use immediate update for better UX, but debounce for performance monitoring
      setInputValue(e.target.value);
    },
    []
  );

  return (
    <div className="chatbot-bg">
      <div className="chatbot-container">
        {/* Header */}
        <div className="chatbot-header">
          <div className="chatbot-header-left">
            <div className="chatbot-icon-bg">
              <span className="chatbot-icon">🤖</span>
            </div>
            <h1 className="chatbot-title">AI Chatbot</h1>
          </div>
          <ConnectionStatus
            isConnected={isConnected}
            isReconnecting={isReconnecting}
          />
        </div>

        {/* Error Banner */}
        {error && (
          <ErrorBanner
            error={error}
            isReconnecting={isReconnecting}
            onRetry={handleRetry}
          />
        )}

        {/* Messages Container */}
        <div ref={messagesContainerRef} className="chatbot-messages">
          {shouldShowWelcome && <WelcomeMessage />}

          {/* Render messages directly to avoid virtualization overlap issues */}
          {messages.length > 0 &&
            messages.map(message => (
              <MessageItem key={message.id} message={message} />
            ))}

          {/* Loading indicator */}
          {isLoading && <LoadingIndicator />}
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="chatbot-input-row">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder={placeholderText}
            disabled={!isConnected || isSending}
            className="chatbot-input"
          />
          <button
            type="submit"
            disabled={isFormDisabled}
            className="chatbot-send-btn"
          >
            <span role="img" aria-label="Send">
              📤
            </span>
          </button>
        </form>
      </div>
    </div>
  );
});

ChatbotPage.displayName = 'ChatbotPage';

export default ChatbotPage;
