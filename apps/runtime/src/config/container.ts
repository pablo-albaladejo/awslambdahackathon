import { logger } from '@awslambdahackathon/utils/lambda';
import { ConnectionRepository } from '@domain/repositories/connection';
import { MessageRepository } from '@domain/repositories/message';
import { SessionRepository } from '@domain/repositories/session';
import { UserRepository } from '@domain/repositories/user';
import { AuthenticationService } from '@domain/services/authentication-service';
import { ChatService } from '@domain/services/chat-service';
import { ConnectionService } from '@domain/services/connection-service';
import { MetricsService } from '@domain/services/metrics-service';
import { PerformanceMonitoringService } from '@domain/services/performance-monitoring-service';
import {
  AuthResponse,
  WebSocketMessage,
  WebSocketMessageService,
} from '@domain/services/websocket-message-service';
import { DynamoDBConnectionRepository } from '@infrastructure/adapters/outbound/dynamodb/dynamodb-connection';
import { DynamoDBMessageRepository } from '@infrastructure/adapters/outbound/dynamodb/dynamodb-message';
import { DynamoDBSessionRepository } from '@infrastructure/adapters/outbound/dynamodb/dynamodb-session';
import { DynamoDBUserRepository } from '@infrastructure/adapters/outbound/dynamodb/dynamodb-user';
import { AwsWebSocketAdapterFactory } from '@infrastructure/adapters/outbound/websocket';
import {
  ApplicationErrorHandlingService,
  ErrorHandlingService,
} from '@infrastructure/services/app-error-handling-service';
import { AuthenticationService as AuthenticationServiceImpl } from '@infrastructure/services/authentication-service';
import { ChatService as ChatServiceImpl } from '@infrastructure/services/chat-service';
import { CircuitBreakerService } from '@infrastructure/services/circuit-breaker-service';
import { CloudWatchPerformanceMonitoringService } from '@infrastructure/services/cloudwatch-performance-monitoring-service';
import { ConnectionService as ConnectionServiceImpl } from '@infrastructure/services/connection-service';
import { CloudWatchMetricsService } from '@infrastructure/services/metrics-service';
import { WebSocketMessageService as WebSocketMessageServiceImpl } from '@infrastructure/services/websocket-message-service';
import type { APIGatewayProxyEvent } from 'aws-lambda';

export interface User {
  userId: string;
  username: string;
  email: string;
  groups: string[];
}

export interface Connection {
  connectionId: string;
  timestamp: string;
  ttl: number;
}

export interface ErrorContext {
  requestId?: string;
  connectionId?: string;
  userId?: string;
  action?: string;
  event?: APIGatewayProxyEvent;
  correlationId?: string;
  timestamp?: string;
  userAgent?: string;
  sourceIp?: string;
  stage?: string;
}

export interface MetricsMetadata {
  connectionId?: string;
  userId?: string;
  errorType?: string;
  [key: string]: unknown;
}

export interface AuthResponseData {
  userId?: string;
  username?: string;
  error?: string;
}

export interface ChatResponseData {
  message: string;
  sessionId: string;
  isEcho: boolean;
}

export interface CircuitBreakerConfig {
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
  failureThreshold?: number;
  recoveryTimeout?: number;
  expectedResponseTime?: number;
  monitoringWindow?: number;
  minimumRequestCount?: number;
}

export interface CircuitBreakerStats {
  state: string;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  nextAttemptTime: Date | null;
  failureRate: number;
}

// Service interfaces for dependency injection - using domain interfaces
export type ConnectionServiceType = ConnectionService;
export type ChatServiceType = ChatService;
export type AuthenticationServiceType = AuthenticationService;
export type WebSocketMessageServiceType = WebSocketMessageService;

export class ServiceRegistry {
  private services: Map<string, unknown> = new Map();

  register<T>(serviceName: string, service: T): void {
    this.services.set(serviceName, service);
    logger.debug('Service registered', { serviceName });
  }

  get<T>(serviceName: string): T {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service '${serviceName}' not found in registry`);
    }
    return service as T;
  }

  has(serviceName: string): boolean {
    return this.services.has(serviceName);
  }

  getAllServiceNames(): string[] {
    return Array.from(this.services.keys());
  }
}

export class ServiceFactory {
  private readonly websocketAdapterFactory: AwsWebSocketAdapterFactory;

  constructor() {
    this.websocketAdapterFactory = new AwsWebSocketAdapterFactory();
  }

  createConnectionService(): ConnectionServiceType {
    return new ConnectionServiceImpl();
  }

  createAuthenticationService(): AuthenticationServiceType {
    return new AuthenticationServiceImpl();
  }

  createChatService(): ChatServiceType {
    return new ChatServiceImpl();
  }

  createErrorHandlingService(): ErrorHandlingService {
    return new ApplicationErrorHandlingService();
  }

  createMetricsService(): MetricsService {
    return new CloudWatchMetricsService();
  }

  createPerformanceMonitoringService(): PerformanceMonitoringService {
    return new CloudWatchPerformanceMonitoringService();
  }

  createCircuitBreakerService(): CircuitBreakerService {
    return new CircuitBreakerService();
  }

  // Repository creation methods
  createUserRepository(): UserRepository {
    return new DynamoDBUserRepository();
  }

  createConnectionRepository(): ConnectionRepository {
    return new DynamoDBConnectionRepository();
  }

  createMessageRepository(): MessageRepository {
    return new DynamoDBMessageRepository();
  }

  createSessionRepository(): SessionRepository {
    return new DynamoDBSessionRepository();
  }
}

export class Container {
  private static instance: Container;
  private registry: ServiceRegistry;
  private factory: ServiceFactory;

  private constructor() {
    this.registry = new ServiceRegistry();
    this.factory = new ServiceFactory();
    this.initializeServices();
  }

  public static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }

  private initializeServices(): void {
    logger.info('Initializing services in container');

    // Register repositories first
    this.registry.register(
      'userRepository',
      this.factory.createUserRepository()
    );
    this.registry.register(
      'connectionRepository',
      this.factory.createConnectionRepository()
    );
    this.registry.register(
      'messageRepository',
      this.factory.createMessageRepository()
    );
    this.registry.register(
      'sessionRepository',
      this.factory.createSessionRepository()
    );

    // Register services using factory
    this.registry.register(
      'connectionService',
      this.factory.createConnectionService()
    );
    this.registry.register(
      'authenticationService',
      this.factory.createAuthenticationService()
    );
    this.registry.register('chatService', this.factory.createChatService());
    this.registry.register(
      'errorHandlingService',
      this.factory.createErrorHandlingService()
    );
    this.registry.register(
      'metricsService',
      this.factory.createMetricsService()
    );
    this.registry.register(
      'performanceMonitoringService',
      this.factory.createPerformanceMonitoringService()
    );
    this.registry.register(
      'circuitBreakerService',
      this.factory.createCircuitBreakerService()
    );

    logger.info('Services initialized successfully', {
      services: this.registry.getAllServiceNames(),
    });
  }

  // Convenience methods for commonly used services
  public getConnectionService(): ConnectionServiceType {
    return this.registry.get<ConnectionServiceType>('connectionService');
  }

  public getAuthenticationService(): AuthenticationServiceType {
    return this.registry.get<AuthenticationServiceType>(
      'authenticationService'
    );
  }

  public getChatService(): ChatServiceType {
    return this.registry.get<ChatServiceType>('chatService');
  }

  public getErrorHandlingService(): ErrorHandlingService {
    return this.registry.get<ErrorHandlingService>('errorHandlingService');
  }

  public getMetricsService(): MetricsService {
    return this.registry.get<MetricsService>('metricsService');
  }

  public createWebSocketMessageService(
    event: APIGatewayProxyEvent
  ): WebSocketMessageServiceType {
    const infrastructureService = new WebSocketMessageServiceImpl();

    // Create an adapter that implements the domain interface
    return {
      async sendMessage(
        connectionId: string,
        message: WebSocketMessage
      ): Promise<boolean> {
        return infrastructureService.sendMessage(connectionId, event, message);
      },
      async sendAuthResponse(
        connectionId: string,
        success: boolean,
        data: AuthResponse
      ): Promise<boolean> {
        return infrastructureService.sendAuthResponse(
          connectionId,
          event,
          success,
          data
        );
      },
      async sendChatResponse(
        connectionId: string,
        message: string,
        sessionId: string,
        isEcho: boolean
      ): Promise<boolean> {
        return infrastructureService.sendChatResponse(
          connectionId,
          event,
          message,
          sessionId,
          isEcho
        );
      },
      async sendErrorMessage(
        connectionId: string,
        errorMessage: string
      ): Promise<boolean> {
        return infrastructureService.sendErrorMessage(
          connectionId,
          event,
          errorMessage
        );
      },
      async sendSystemMessage(
        connectionId: string,
        text: string
      ): Promise<boolean> {
        return infrastructureService.sendSystemMessage(
          connectionId,
          event,
          text
        );
      },
      cleanup(): void {
        infrastructureService.cleanup();
      },
    };
  }

  public getPerformanceMonitoringService(): PerformanceMonitoringService {
    return this.registry.get<PerformanceMonitoringService>(
      'performanceMonitoringService'
    );
  }

  public getCircuitBreakerService(): CircuitBreakerService {
    return this.registry.get<CircuitBreakerService>('circuitBreakerService');
  }

  // Generic getter for advanced usage
  public get<T>(serviceName: string): T {
    return this.registry.get<T>(serviceName);
  }

  // For testing and advanced scenarios
  public set(serviceName: string, service: unknown): void {
    this.registry.register(serviceName, service);
  }
}

// Global container instance
export const container = Container.getInstance();
