import {
  AuthenticateUserUseCase,
  AuthenticateUserUseCaseImpl,
} from '@application/use-cases/authenticate-user';
import {
  CheckAuthenticatedConnectionUseCase,
  CheckAuthenticatedConnectionUseCaseImpl,
} from '@application/use-cases/check-authenticated-connection';
import {
  HandlePingMessageUseCase,
  HandlePingMessageUseCaseImpl,
} from '@application/use-cases/handle-ping-message';
import {
  RemoveAuthenticatedConnectionUseCase,
  RemoveAuthenticatedConnectionUseCaseImpl,
} from '@application/use-cases/remove-authenticated-connection';
import {
  RemoveConnectionUseCase,
  RemoveConnectionUseCaseImpl,
} from '@application/use-cases/remove-connection';
import {
  SendChatMessageUseCase,
  SendChatMessageUseCaseImpl,
} from '@application/use-cases/send-chat-message';
import {
  StoreConnectionUseCase,
  StoreConnectionUseCaseImpl,
} from '@application/use-cases/store-connection';
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

// Configuration interfaces for better dependency injection
export interface DynamoDBConfig {
  tableName: string;
  region: string;
  endpoint?: string;
}

export interface DynamoDBRepositoryConfig {
  connectionsTable: string;
  messagesTable: string;
  sessionsTable: string;
  usersTable: string;
  region: string;
  endpoint?: string;
}

export interface CloudWatchConfig {
  namespace: string;
  region: string;
  logGroupName: string;
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

export interface AppConfig {
  dynamoDB: DynamoDBRepositoryConfig;
  cloudWatch: CloudWatchConfig;
  circuitBreaker: CircuitBreakerConfig;
  environment: string;
  stage: string;
}

// Logger interface for dependency injection
export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

// Legacy interfaces for backward compatibility
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
  private readonly config: AppConfig;
  private readonly logger: Logger;

  constructor(config: AppConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.websocketAdapterFactory = new AwsWebSocketAdapterFactory();
  }

  // Use case creation methods
  createAuthenticateUserUseCase(): AuthenticateUserUseCase {
    return new AuthenticateUserUseCaseImpl(
      this.createAuthenticationService(),
      this.logger,
      this.createPerformanceMonitoringService()
    );
  }

  createSendChatMessageUseCase(): SendChatMessageUseCase {
    return new SendChatMessageUseCaseImpl(
      this.createChatService(),
      this.logger,
      this.createPerformanceMonitoringService()
    );
  }

  createStoreConnectionUseCase(): StoreConnectionUseCase {
    return new StoreConnectionUseCaseImpl(
      this.createConnectionService(),
      this.logger,
      this.createPerformanceMonitoringService()
    );
  }

  createRemoveConnectionUseCase(): RemoveConnectionUseCase {
    return new RemoveConnectionUseCaseImpl(
      this.createConnectionService(),
      this.logger,
      this.createPerformanceMonitoringService()
    );
  }

  createRemoveAuthenticatedConnectionUseCase(): RemoveAuthenticatedConnectionUseCase {
    return new RemoveAuthenticatedConnectionUseCaseImpl(
      this.createAuthenticationService(),
      this.logger,
      this.createPerformanceMonitoringService()
    );
  }

  createCheckAuthenticatedConnectionUseCase(): CheckAuthenticatedConnectionUseCase {
    return new CheckAuthenticatedConnectionUseCaseImpl(
      this.createAuthenticationService(),
      this.logger,
      this.createPerformanceMonitoringService()
    );
  }

  createHandlePingMessageUseCase(): HandlePingMessageUseCase {
    return new HandlePingMessageUseCaseImpl(
      this.logger,
      this.createPerformanceMonitoringService()
    );
  }

  // Existing service creation methods
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
    return new CircuitBreakerService(this.config.circuitBreaker);
  }

  // Repository creation methods with configuration injection
  createUserRepository(): UserRepository {
    return new DynamoDBUserRepository({
      tableName: this.config.dynamoDB.usersTable,
      region: this.config.dynamoDB.region,
      endpoint: this.config.dynamoDB.endpoint,
    });
  }

  createConnectionRepository(): ConnectionRepository {
    return new DynamoDBConnectionRepository({
      tableName: this.config.dynamoDB.connectionsTable,
      region: this.config.dynamoDB.region,
      endpoint: this.config.dynamoDB.endpoint,
    });
  }

  createMessageRepository(): MessageRepository {
    return new DynamoDBMessageRepository({
      tableName: this.config.dynamoDB.messagesTable,
      region: this.config.dynamoDB.region,
      endpoint: this.config.dynamoDB.endpoint,
    });
  }

  createSessionRepository(): SessionRepository {
    return new DynamoDBSessionRepository({
      tableName: this.config.dynamoDB.sessionsTable,
      region: this.config.dynamoDB.region,
      endpoint: this.config.dynamoDB.endpoint,
    });
  }

  // Logger getter
  getLogger(): Logger {
    return this.logger;
  }
}

export class Container {
  private static instance: Container;
  private registry: ServiceRegistry;
  private factory: ServiceFactory;
  private config: AppConfig;
  private logger: Logger;

  private constructor(config?: Partial<AppConfig>, logger?: Logger) {
    this.config = this.createDefaultConfig(config);
    this.logger = logger || this.createDefaultLogger();
    this.registry = new ServiceRegistry();
    this.factory = new ServiceFactory(this.config, this.logger);
    this.initializeServices();
  }

  public static getInstance(
    config?: Partial<AppConfig>,
    logger?: Logger
  ): Container {
    if (!Container.instance) {
      Container.instance = new Container(config, logger);
    }
    return Container.instance;
  }

  private createDefaultConfig(overrides?: Partial<AppConfig>): AppConfig {
    return {
      dynamoDB: {
        connectionsTable:
          process.env.WEBSOCKET_CONNECTIONS_TABLE || 'websocket-connections',
        messagesTable:
          process.env.WEBSOCKET_MESSAGES_TABLE || 'websocket-messages',
        sessionsTable:
          process.env.WEBSOCKET_SESSIONS_TABLE || 'websocket-sessions',
        usersTable: process.env.WEBSOCKET_USERS_TABLE || 'websocket-users',
        region: process.env.AWS_REGION || 'us-east-1',
        endpoint: process.env.DYNAMODB_ENDPOINT,
      },
      cloudWatch: {
        namespace: process.env.CLOUDWATCH_NAMESPACE || 'WebSocketService',
        region: process.env.AWS_REGION || 'us-east-1',
        logGroupName:
          process.env.CLOUDWATCH_LOG_GROUP || '/aws/lambda/websocket-service',
      },
      circuitBreaker: {
        timeout: 5000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        failureThreshold: 5,
        recoveryTimeout: 60000,
        expectedResponseTime: 1000,
        monitoringWindow: 60000,
        minimumRequestCount: 10,
        ...overrides?.circuitBreaker,
      },
      environment: process.env.NODE_ENV || 'development',
      stage: process.env.STAGE || 'dev',
      ...overrides,
    };
  }

  private createDefaultLogger(): Logger {
    return {
      info: (message: string, meta?: Record<string, unknown>) => {
        if (meta) {
          logger.info(message, meta);
        } else {
          logger.info(message);
        }
      },
      warn: (message: string, meta?: Record<string, unknown>) => {
        if (meta) {
          logger.warn(message, meta);
        } else {
          logger.warn(message);
        }
      },
      error: (message: string, meta?: Record<string, unknown>) => {
        if (meta) {
          logger.error(message, meta);
        } else {
          logger.error(message);
        }
      },
      debug: (message: string, meta?: Record<string, unknown>) => {
        if (meta) {
          logger.debug(message, meta);
        } else {
          logger.debug(message);
        }
      },
    };
  }

  private initializeServices(): void {
    this.logger.info('Initializing services in container', {
      config: this.config,
    });

    // Register logger first
    this.registry.register('logger', this.logger);

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

    // Register use cases
    this.registry.register(
      'authenticateUserUseCase',
      this.factory.createAuthenticateUserUseCase()
    );
    this.registry.register(
      'sendChatMessageUseCase',
      this.factory.createSendChatMessageUseCase()
    );
    this.registry.register(
      'storeConnectionUseCase',
      this.factory.createStoreConnectionUseCase()
    );
    this.registry.register(
      'removeConnectionUseCase',
      this.factory.createRemoveConnectionUseCase()
    );
    this.registry.register(
      'removeAuthenticatedConnectionUseCase',
      this.factory.createRemoveAuthenticatedConnectionUseCase()
    );
    this.registry.register(
      'checkAuthenticatedConnectionUseCase',
      this.factory.createCheckAuthenticatedConnectionUseCase()
    );
    this.registry.register(
      'handlePingMessageUseCase',
      this.factory.createHandlePingMessageUseCase()
    );

    this.logger.info('Services initialized successfully', {
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

  public getLogger(): Logger {
    return this.registry.get<Logger>('logger');
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

  // Configuration getter
  public getConfig(): AppConfig {
    return this.config;
  }

  // Use case convenience methods
  public getAuthenticateUserUseCase(): AuthenticateUserUseCase {
    return this.registry.get<AuthenticateUserUseCase>(
      'authenticateUserUseCase'
    );
  }

  public getSendChatMessageUseCase(): SendChatMessageUseCase {
    return this.registry.get<SendChatMessageUseCase>('sendChatMessageUseCase');
  }

  public getStoreConnectionUseCase(): StoreConnectionUseCase {
    return this.registry.get<StoreConnectionUseCase>('storeConnectionUseCase');
  }

  public getRemoveConnectionUseCase(): RemoveConnectionUseCase {
    return this.registry.get<RemoveConnectionUseCase>(
      'removeConnectionUseCase'
    );
  }

  public getRemoveAuthenticatedConnectionUseCase(): RemoveAuthenticatedConnectionUseCase {
    return this.registry.get<RemoveAuthenticatedConnectionUseCase>(
      'removeAuthenticatedConnectionUseCase'
    );
  }

  public getCheckAuthenticatedConnectionUseCase(): CheckAuthenticatedConnectionUseCase {
    return this.registry.get<CheckAuthenticatedConnectionUseCase>(
      'checkAuthenticatedConnectionUseCase'
    );
  }

  public getHandlePingMessageUseCase(): HandlePingMessageUseCase {
    return this.registry.get<HandlePingMessageUseCase>(
      'handlePingMessageUseCase'
    );
  }
}

// Global container instance
export const container = Container.getInstance();
