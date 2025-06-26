import { logger } from '@awslambdahackathon/utils/frontend';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { VirtualizedMessageList } from './components/VirtualizedMessageList';
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
  // Performance monitoring for individual messages
  usePerformance({
    componentName: 'MessageItem',
    logRenderTime: false, // Disable for individual messages to reduce noise
  });

  const messageTime = useMemo(
    () => message.timestamp.toLocaleTimeString(),
    [message.timestamp]
  );

  return (
    <div className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
          message.isUser
            ? 'bg-blue-600 text-white'
            : 'bg-white text-gray-900 border border-gray-200'
        }`}
      >
        <p className="text-sm">{message.text}</p>
        <p
          className={`text-xs mt-1 ${
            message.isUser ? 'text-blue-100' : 'text-gray-500'
          }`}
        >
          {messageTime}
        </p>
      </div>
    </div>
  );
});

MessageItem.displayName = 'MessageItem';

// Memoized Loading Indicator
const LoadingIndicator = React.memo(() => (
  <div className="flex justify-start">
    <div className="bg-white text-gray-900 border border-gray-200 rounded-lg px-4 py-2">
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
  <div className="flex items-center space-x-2">
    <div
      className={`w-3 h-3 rounded-full ${
        isConnected
          ? 'bg-green-500'
          : isReconnecting
            ? 'bg-yellow-500'
            : 'bg-red-500'
      }`}
    />
    <span className="text-sm text-gray-600">
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
  } = useWebSocket();
  const { trackEvent } = useRumTracking();
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Performance monitoring
  const { getPerformanceStats, debounce } = usePerformance({
    componentName: 'ChatbotPage',
    logRenderTime: true,
    logMemoryUsage: true,
    threshold: 16, // 60fps threshold
  });

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

  // Memoized button text
  const buttonText = useMemo(
    () => (isSending ? 'Sending...' : 'Send'),
    [isSending]
  );

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

  // Debounced input change handler for better performance
  const debouncedInputChange = useMemo(
    () =>
      debounce((value: string) => {
        setInputValue(value);
      }, 100),
    [debounce]
  );

  // Memoized container height calculation
  const containerHeight = useMemo(() => {
    if (messagesContainerRef.current) {
      return messagesContainerRef.current.offsetHeight;
    }
    return 400; // Default height
  }, []);

  useEffect(() => {
    if (user) {
      trackEvent('chatbot_page_viewed', {
        userId: userInfo.userId,
        username: userInfo.username,
      });
    }
  }, [user, trackEvent, userInfo]);

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

        trackEvent('message_sent', {
          userId: userInfo.userId,
          messageLength: messageText.length,
        });

        logger.info('Message sent successfully', {
          userId: userInfo.userId,
          messageLength: messageText.length,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to send message';

        logger.error('Failed to send message', {
          error: errorMessage,
          userId: userInfo.userId,
          messageLength: messageText.length,
        });

        trackEvent('message_send_error', {
          userId: userInfo.userId,
          error: errorMessage,
        });

        // Show error to user (error state is already handled by WebSocket context)
      } finally {
        setIsSending(false);
      }
    },
    [inputValue, isSending, isConnected, sendMessage, trackEvent, userInfo]
  );

  const handleRetry = useCallback(async () => {
    if (error && !isReconnecting) {
      trackEvent('connection_retry', {
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
  }, [error, isReconnecting, trackEvent, userInfo]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Use immediate update for better UX, but debounce for performance monitoring
      setInputValue(e.target.value);
      debouncedInputChange(e.target.value);
    },
    [debouncedInputChange]
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">AI Chatbot</h1>
            <p className="text-sm text-gray-500">
              Welcome, {userInfo.username}!
            </p>
          </div>

          <ConnectionStatus
            isConnected={isConnected}
            isReconnecting={isReconnecting}
          />
        </div>
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
      <div ref={messagesContainerRef} className="flex-1 overflow-hidden p-6">
        {shouldShowWelcome && <WelcomeMessage />}

        {/* Use virtualized list for better performance with large message counts */}
        {messages.length > 0 && (
          <VirtualizedMessageList
            messages={messages}
            itemHeight={80}
            containerHeight={containerHeight}
            overscan={5}
          />
        )}

        {/* Loading indicator */}
        {isLoading && <LoadingIndicator />}
      </div>

      {/* Input Form */}
      <div className="bg-white border-t px-6 py-4">
        <form onSubmit={handleSubmit} className="flex space-x-4">
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder={placeholderText}
            disabled={!isConnected || isSending}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
          />
          <button
            type="submit"
            disabled={isFormDisabled}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {buttonText}
          </button>
        </form>
      </div>
    </div>
  );
});

ChatbotPage.displayName = 'ChatbotPage';

export default ChatbotPage;
