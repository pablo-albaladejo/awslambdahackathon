import { logger } from '@awslambdahackathon/utils/frontend';
import React, { useEffect, useRef } from 'react';

import './App.css';
import { useWebSocket } from './contexts/WebSocketContext';
import './index.css';

export default function ChatbotPage() {
  const { messages, sendMessage, isLoading, isConnected } = useWebSocket();
  const [inputMessage, setInputMessage] = React.useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Welcome message if there are no messages
  const displayMessages = messages.filter(
    message =>
      ![
        'Connected to chatbot',
        'Disconnected from chatbot',
        'Error: Could not connect to chatbot',
      ].includes(message.text)
  );
  const shouldShowWelcome = displayMessages.length === 0;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !isConnected || isLoading) return;

    try {
      await sendMessage(inputMessage.trim());
      setInputMessage('');
    } catch (error) {
      logger.error('Failed to send message:', error);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="chatbot-outer-wrapper">
      <div className="chatbot-container">
        <div className="chatbot-header">
          <div className="chatbot-header-left">
            <span
              className="chatbot-icon chatbot-icon-bg"
              role="img"
              aria-label="bot"
            >
              🤖
            </span>
            <span className="chatbot-title">Chatbot</span>
          </div>
          <div
            className={`chatbot-connection-indicator ${isConnected ? 'connected' : 'disconnected'}`}
          >
            <span
              className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`}
            />
            <span className="chatbot-connection-text">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
        <div className="messages-container">
          {shouldShowWelcome && (
            <div className="message bot-message">
              <div className="message-content">Hello! How can I help you?</div>
              <div className="message-timestamp">
                {new Date().toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          )}
          {displayMessages.map(message => (
            <div
              key={message.id}
              className={`message ${message.isUser ? 'user-message' : 'bot-message'}`}
            >
              <div className="message-content">{message.text}</div>
              <div className="message-timestamp">
                {message.timestamp.toLocaleTimeString()}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="input-container">
          <textarea
            value={inputMessage}
            onChange={e => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={!isConnected || isLoading}
            className="message-input"
          />
          <button
            onClick={handleSendMessage}
            disabled={!isConnected || isLoading || !inputMessage.trim()}
            className="send-button"
          >
            {isLoading ? (
              'Sending...'
            ) : (
              <span role="img" aria-label="send">
                📨
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
