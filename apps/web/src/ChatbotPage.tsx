import { useAuthenticator } from '@aws-amplify/ui-react';
import { fetchAuthSession } from 'aws-amplify/auth';
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

  const getAccessToken = async (): Promise<string | null> => {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.accessToken?.toString() || null;
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  };

  const connectWebSocket = async () => {
    if (!user) return;

    try {
      const token = await getAccessToken();
      if (!token) {
        console.error('No access token available');
        return;
      }

      // Create WebSocket connection with authentication
      const wsUrl = `${websocketConfig.url}?token=${token}`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected');
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
          console.log('Received message:', data);

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
          console.error('Error parsing WebSocket message:', error);
        }
        setIsLoading(false);
      };

      ws.onclose = event => {
        console.log('WebSocket disconnected:', event.code, event.reason);
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
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
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
    <div className="chatbot-container">
      <div className="chatbot-header">
        <h1>🤖 Chatbot</h1>
        <div className="connection-status">
          <span
            className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}
          >
            {isConnected ? '🟢 Conectado' : '🔴 Desconectado'}
          </span>
        </div>
      </div>

      <div className="chatbot-content">
        <div className="messages-container">
          {messages.map(message => (
            <div
              key={message.id}
              className={`message ${message.isUser ? 'user-message' : 'bot-message'}`}
            >
              <div className="message-content">
                <p>{message.text}</p>
                <span className="message-time">
                  {formatTime(message.timestamp)}
                </span>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="message bot-message">
              <div className="message-content">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-container">
          <div className="input-wrapper">
            <textarea
              value={inputMessage}
              onChange={e => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Escribe tu mensaje..."
              disabled={!isConnected || isLoading}
              rows={1}
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || !isConnected || isLoading}
              className="send-button"
            >
              📤
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatbotPage;
