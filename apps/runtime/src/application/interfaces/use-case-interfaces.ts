// Store Connection Use Case
export interface StoreConnectionUseCase {
  execute(command: {
    connectionId: string;
    sessionId?: string;
  }): Promise<{ success: boolean; error?: string; errorCode?: string }>;
}

// Remove Connection Use Case
export interface RemoveConnectionUseCase {
  execute(command: {
    connectionId: string;
  }): Promise<{ success: boolean; error?: string; errorCode?: string }>;
}

// Remove Authenticated Connection Use Case
export interface RemoveAuthenticatedConnectionUseCase {
  execute(command: {
    connectionId: string;
  }): Promise<{ success: boolean; error?: string; errorCode?: string }>;
}

// Authenticate User Use Case
export interface AuthenticateUserUseCase {
  execute(command: { token: string }): Promise<{
    success: boolean;
    error?: string;
    errorCode?: string;
    userId?: string;
    user?: unknown;
  }>;
}

// Send Chat Message Use Case
export interface SendChatMessageUseCase {
  execute(command: {
    content: string;
    userId: string;
    sessionId: string;
    connectionId: string;
  }): Promise<{
    success: boolean;
    error?: string;
    errorCode?: string;
    message?: { getContent(): string; getSessionId(): { getValue(): string } };
  }>;
}

// Handle Ping Message Use Case
export interface HandlePingMessageUseCase {
  execute(command: {
    connectionId: string;
  }): Promise<{ success: boolean; error?: string; errorCode?: string }>;
}

// Check Authenticated Connection Use Case
export interface CheckAuthenticatedConnectionUseCase {
  execute(command: { connectionId: string }): Promise<{
    success: boolean;
    error?: string;
    errorCode?: string;
    isAuthenticated?: boolean;
  }>;
}
