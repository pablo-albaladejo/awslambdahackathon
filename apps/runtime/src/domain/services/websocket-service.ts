export interface WebSocketService {
  sendMessage(connectionId: string, message: string): Promise<void>;
  disconnect(connectionId: string): Promise<void>;
}
