import { logger } from '@awslambdahackathon/utils/frontend';
import React, { useEffect, useRef, useState } from 'react';

import { useWebSocket } from './contexts/WebSocketContext';
import { useCurrentUser } from './hooks/useCurrentUser';
import { useRumTracking } from './hooks/useRumTracking';

import './App.css';
import './index.css';

export default function ChatbotPage() {
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (user) {
      trackEvent('chatbot_page_viewed', {
        userId: user.attributes?.sub || user.email,
        username: user.email || 'User',
      });
    }
  }, [user, trackEvent]);

  const handleSubmit = async (e: React.FormEvent) => {
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
        userId: user?.attributes?.sub || user?.email,
        messageLength: messageText.length,
      });

      logger.info('Message sent successfully', {
        userId: user?.attributes?.sub || user?.email,
        messageLength: messageText.length,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to send message';

      logger.error('Failed to send message', {
        error: errorMessage,
        userId: user?.attributes?.sub || user?.email,
        messageLength: messageText.length,
      });

      trackEvent('message_send_error', {
        userId: user?.attributes?.sub || user?.email,
        error: errorMessage,
      });

      // Show error to user (error state is already handled by WebSocket context)
    } finally {
      setIsSending(false);
    }
  };

  const handleRetry = async () => {
    if (error && !isReconnecting) {
      trackEvent('connection_retry', {
        userId: user?.attributes?.sub || user?.email,
        error: error,
      });

      // The WebSocket context will handle reconnection automatically
      // This is just for user feedback
      logger.info('User initiated connection retry', {
        userId: user?.attributes?.sub || user?.email,
        error: error,
      });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">AI Chatbot</h1>
            <p className="text-sm text-gray-500">
              Welcome, {user?.email || 'User'}!
            </p>
          </div>

          {/* Connection Status */}
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
        </div>
      </div>

      {/* Error Banner */}
      {error && (
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
                onClick={handleRetry}
                className="text-red-700 hover:text-red-900 text-sm font-medium underline"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && !error && (
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
        )}

        {messages.map(message => (
          <div
            key={message.id}
            className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
          >
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
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
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
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="bg-white border-t px-6 py-4">
        <form onSubmit={handleSubmit} className="flex space-x-4">
          <input
            type="text"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            placeholder={
              !isConnected
                ? 'Connecting...'
                : isSending
                  ? 'Sending...'
                  : 'Type your message...'
            }
            disabled={!isConnected || isSending}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:text-gray-500"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || !isConnected || isSending}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}
