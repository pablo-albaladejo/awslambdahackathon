import { useAuthenticator } from '@aws-amplify/ui-react';
import { logger } from '@awslambdahackathon/utils/frontend';
import React, { useEffect, useRef, useState } from 'react';

import { websocketConfig } from './config/websocket';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
  sessionId?: string;
}

const ChatbotPage: React.FC = () => {
  const { user } = useAuthenticator();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const connectWebSocket = async () => {
    if (!user) return;

    try {
      // For now, connect without authentication
      // TODO: Add token-based authentication when authorizer is configured
      const wsUrl = websocketConfig.url;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        logger.info('WebSocket connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        // Add welcome message
        setMessages(prev => [
          ...prev,
          {
            id: Date.now().toString(),
            text: '¡Hola! Soy tu asistente. ¿En qué puedo ayudarte?',
            isUser: false,
            timestamp: new Date(),
          },
        ]);
      };

      ws.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          logger.info('Received message:', data);

          if (data.message) {
            setMessages(prev => [
              ...prev,
              {
                id: Date.now().toString(),
                text: data.message,
                isUser: false,
                timestamp: new Date(),
                sessionId: data.sessionId,
              },
            ]);

            // Update session ID if provided
            if (data.sessionId && !sessionId) {
              setSessionId(data.sessionId);
            }
          }
        } catch (error) {
          logger.error('Error parsing WebSocket message:', error);
        }
        setIsLoading(false);
      };

      ws.onclose = event => {
        logger.info('WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);

        // Attempt to reconnect if not a normal closure
        if (
          event.code !== 1000 &&
          reconnectAttemptsRef.current < websocketConfig.maxReconnectAttempts
        ) {
          setTimeout(() => {
            reconnectAttemptsRef.current++;
            connectWebSocket();
          }, websocketConfig.reconnectInterval);
        }
      };

      ws.onerror = error => {
        logger.error('WebSocket error:', error);
        setIsConnected(false);
      };

      wsRef.current = ws;
    } catch (error) {
      logger.error('Error connecting to WebSocket:', error);
      setIsConnected(false);
    }
  };

  useEffect(() => {
    if (user) {
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [user]);

  const sendMessage = () => {
    if (!inputMessage.trim() || !isConnected || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputMessage,
      isUser: true,
      timestamp: new Date(),
      sessionId,
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Send message through WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const messageData = {
        action: 'sendMessage',
        message: inputMessage,
        sessionId,
      };
      wsRef.current.send(JSON.stringify(messageData));
    }

    setInputMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!user) {
    return (
      <div className="chatbot-container">
        <div className="chatbot-header">
          <h1>🤖 Chatbot</h1>
        </div>
        <div className="chatbot-content">
          <p>Por favor, inicia sesión para usar el chatbot.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chatbot-bg">
      <div className="chatbot-card">
        <div className="chatbot-header-row">
          <h1 className="chatbot-title">🤖 Chatbot</h1>
          <span
            className={`chatbot-status ${isConnected ? 'connected' : 'disconnected'}`}
          >
            {isConnected ? '🟢 Conectado' : '🔴 Desconectado'}
          </span>
        </div>
        <div className="chatbot-messages" id="messages">
          {messages.map((message, idx) => (
            <div
              key={message.id + idx}
              className={`chatbot-message-bubble ${message.isUser ? 'user' : 'bot'}`}
            >
              <span className="chatbot-message-text">{message.text}</span>
              <span className="chatbot-message-time">
                {formatTime(message.timestamp)}
              </span>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <form
          className="chatbot-input-row"
          onSubmit={e => {
            e.preventDefault();
            sendMessage();
          }}
        >
          <input
            className="chatbot-input"
            type="text"
            placeholder="Escribe tu mensaje..."
            value={inputMessage}
            onChange={e => setInputMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={!isConnected || isLoading}
          />
          <button
            className="chatbot-send-btn"
            type="submit"
            disabled={!inputMessage.trim() || !isConnected || isLoading}
          >
            <span role="img" aria-label="Enviar">
              📤
            </span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatbotPage;
