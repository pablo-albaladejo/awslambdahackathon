import { authenticationService } from '../services/authentication-service';
import { chatService } from '../services/chat-service';
import { ConnectionService } from '../services/connection-service';
import { errorHandlingService } from '../services/error-handling-service';
import { metricsService } from '../services/metrics-service';
import { websocketMessageService } from '../services/websocket-message-service';

// Service interfaces for dependency injection
export interface IConnectionService {
  storeConnection(connectionId: string): Promise<void>;
  removeConnection(connectionId: string): Promise<void>;
  getConnection(connectionId: string): Promise<any>;
}

export interface IAuthenticationService {
  storeAuthenticatedConnection(connectionId: string, user: any): Promise<void>;
  removeAuthenticatedConnection(connectionId: string): Promise<void>;
  isConnectionAuthenticated(connectionId: string): Promise<boolean>;
}

export interface IChatService {
  storeAndEchoMessage(params: {
    connectionId: string;
    message: string;
    sessionId?: string;
  }): Promise<{ message: string; sessionId: string }>;
}

export interface IErrorHandlingService {
  handleWebSocketError(
    error: any,
    connectionId: string,
    event: any
  ): Promise<void>;
}

export interface IMetricsService {
  recordErrorMetrics(
    code: string,
    context: string,
    metadata: any
  ): Promise<void>;
  recordBusinessMetrics(
    name: string,
    value: number,
    metadata: any
  ): Promise<void>;
  recordWebSocketMetrics(
    name: string,
    success: boolean,
    duration: number
  ): Promise<void>;
}

export interface IWebSocketMessageService {
  sendAuthResponse(
    connectionId: string,
    event: any,
    success: boolean,
    data: any
  ): Promise<boolean>;
  sendChatResponse(
    connectionId: string,
    event: any,
    message: string,
    sessionId: string,
    isEcho: boolean
  ): Promise<boolean>;
  sendErrorMessage(
    connectionId: string,
    event: any,
    message: string
  ): Promise<boolean>;
}

// Dependency injection container
export class Container {
  private static instance: Container;
  private services: Map<string, any> = new Map();

  private constructor() {
    this.initializeServices();
  }

  public static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  private initializeServices(): void {
    // Register services
    this.services.set('connectionService', new ConnectionService());
    this.services.set('authenticationService', authenticationService);
    this.services.set('chatService', chatService);
    this.services.set('errorHandlingService', errorHandlingService);
    this.services.set('metricsService', metricsService);
    this.services.set('websocketMessageService', websocketMessageService);
  }

  public get<T>(serviceName: string): T {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service '${serviceName}' not found in container`);
    }
    return service as T;
  }

  public set(serviceName: string, service: any): void {
    this.services.set(serviceName, service);
  }

  // Convenience methods for commonly used services
  public getConnectionService(): IConnectionService {
    return this.get<IConnectionService>('connectionService');
  }

  public getAuthenticationService(): IAuthenticationService {
    return this.get<IAuthenticationService>('authenticationService');
  }

  public getChatService(): IChatService {
    return this.get<IChatService>('chatService');
  }

  public getErrorHandlingService(): IErrorHandlingService {
    return this.get<IErrorHandlingService>('errorHandlingService');
  }

  public getMetricsService(): IMetricsService {
    return this.get<IMetricsService>('metricsService');
  }

  public getWebSocketMessageService(): IWebSocketMessageService {
    return this.get<IWebSocketMessageService>('websocketMessageService');
  }
}

// Global container instance
export const container = Container.getInstance();
