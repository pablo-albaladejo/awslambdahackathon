export interface WebSocketMessage {
  type: string;
  message?: string;
  sessionId?: string;
  success?: boolean;
  error?: string;
  isEcho?: boolean;
  [key: string]: unknown;
}

export interface AuthResponse {
  userId?: string;
  username?: string;
  error?: string;
}

export interface ChatResponse {
  message: string;
  sessionId: string;
  isEcho: boolean;
}

export interface WebSocketMessageService {
  sendMessage(
    connectionId: string,
    message: WebSocketMessage
  ): Promise<boolean>;

  sendAuthResponse(
    connectionId: string,
    success: boolean,
    data: AuthResponse
  ): Promise<boolean>;

  sendChatResponse(
    connectionId: string,
    message: string,
    sessionId: string,
    isEcho: boolean
  ): Promise<boolean>;

  sendErrorMessage(
    connectionId: string,
    errorMessage: string
  ): Promise<boolean>;

  sendSystemMessage(connectionId: string, text: string): Promise<boolean>;

  cleanup(): void;
}
