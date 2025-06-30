import { ApiGatewayManagementApiClient } from '@aws-sdk/client-apigatewaymanagementapi';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ConnectionRepository } from '@domain/repositories/connection';
import { MessageRepository } from '@domain/repositories/message';
import { SessionRepository } from '@domain/repositories/session';
import { UserRepository } from '@domain/repositories/user';
import { AuthenticationService as AuthenticationServiceInterface } from '@domain/services/authentication-service';
import { ChatService as ChatServiceInterface } from '@domain/services/chat-service';
import { PerformanceMonitoringService } from '@domain/services/performance-monitoring-service';
import { WebSocketMessageService } from '@domain/services/websocket-message-service';
import { DynamoDBConnectionRepository } from '@infrastructure/adapters/outbound/dynamodb/dynamodb-connection';
import { DynamoDBMessageRepository } from '@infrastructure/adapters/outbound/dynamodb/dynamodb-message';
import { DynamoDBSessionRepository } from '@infrastructure/adapters/outbound/dynamodb/dynamodb-session';
import { DynamoDBUserRepository } from '@infrastructure/adapters/outbound/dynamodb/dynamodb-user';
import { WebSocketServiceAdapter } from '@infrastructure/adapters/outbound/websocket/websocket-service-adapter';
import { ApplicationErrorHandlingService } from '@infrastructure/services/app-error-handling-service';
import { AuthenticationService } from '@infrastructure/services/authentication-service';
import { ChatService } from '@infrastructure/services/chat-service';
import { CircuitBreakerService as CircuitBreakerServiceImpl } from '@infrastructure/services/circuit-breaker-service';
import { CloudWatchPerformanceMonitoringService } from '@infrastructure/services/cloudwatch-performance-monitoring-service';
import { ConnectionManagementService } from '@infrastructure/services/connection-management-service';
import { ConnectionService } from '@infrastructure/services/connection-service';
import { CloudWatchMetricsService } from '@infrastructure/services/metrics-service';

export type Constructor<T = unknown> = new (...args: unknown[]) => T;
export type Token<T = unknown> = Constructor<T> | string;

export interface Container {
  register<T>(
    token: Token<T>,
    implementation: Constructor<T>,
    options?: RegistrationOptions
  ): void;
  resolve<T>(token: Token<T>): T;
  get<T>(token: Token<T>): T;
}

export interface RegistrationOptions {
  singleton?: boolean;
  dependencies?: Token<unknown>[];
}

export interface DynamoDBConfig {
  tableName: string;
  region: string;
  endpoint?: string;
}

export interface WebSocketConfig {
  endpoint: string;
}

export interface CloudWatchConfig {
  namespace: string;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  expectedResponseTime: number;
  monitoringWindow: number;
  minimumRequestCount: number;
}

export interface ErrorContext {
  [key: string]: unknown;
}

class DependencyContainer implements Container {
  private readonly registry = new Map<
    Token,
    { implementation: Constructor; options?: RegistrationOptions }
  >();
  private readonly instances = new Map<Token, unknown>();
  private readonly dynamoDBClient: DynamoDBClient;
  private readonly dynamoDBDocClient: DynamoDBDocumentClient;
  private readonly cloudWatchClient: CloudWatchClient;
  private readonly apiGatewayClient: ApiGatewayManagementApiClient;
  private readonly dynamoDBConfig: DynamoDBConfig;
  private readonly webSocketConfig: WebSocketConfig;
  private readonly cloudWatchConfig: CloudWatchConfig;

  constructor() {
    this.dynamoDBClient = new DynamoDBClient({});
    this.dynamoDBDocClient = DynamoDBDocumentClient.from(this.dynamoDBClient);
    this.cloudWatchClient = new CloudWatchClient({});
    this.apiGatewayClient = new ApiGatewayManagementApiClient({});

    this.dynamoDBConfig = {
      tableName: process.env.DYNAMODB_TABLE_NAME || 'chat-app',
      region: process.env.AWS_REGION || 'us-east-1',
      endpoint: process.env.DYNAMODB_ENDPOINT,
    };

    this.webSocketConfig = {
      endpoint: process.env.WEBSOCKET_ENDPOINT || '',
    };

    this.cloudWatchConfig = {
      namespace: process.env.CLOUDWATCH_NAMESPACE || 'chat-app',
    };

    this.registerServices();
  }

  register<T>(
    token: Token<T>,
    implementation: Constructor<T>,
    options?: RegistrationOptions
  ): void {
    this.registry.set(token, { implementation, options });
  }

  resolve<T>(token: Token<T>): T {
    const registration = this.registry.get(token);
    if (!registration) {
      throw new Error(`No registration found for token: ${token.toString()}`);
    }

    if (registration.options?.singleton) {
      const existingInstance = this.instances.get(token);
      if (existingInstance) {
        return existingInstance as T;
      }
    }

    const { implementation, options } = registration;
    const dependencies = this.resolveDependencies(options?.dependencies || []);
    const instance = new implementation(...dependencies);

    if (options?.singleton) {
      this.instances.set(token, instance);
    }

    return instance as T;
  }

  get<T>(token: Token<T>): T {
    return this.resolve(token);
  }

  // Use case methods with specific types
  getStoreConnectionUseCase(): StoreConnectionUseCase {
    return this.resolve('StoreConnectionUseCase');
  }

  getRemoveConnectionUseCase(): RemoveConnectionUseCase {
    return this.resolve('RemoveConnectionUseCase');
  }

  getRemoveAuthenticatedConnectionUseCase(): RemoveAuthenticatedConnectionUseCase {
    return this.resolve('RemoveAuthenticatedConnectionUseCase');
  }

  getAuthenticateUserUseCase(): AuthenticateUserUseCase {
    return this.resolve('AuthenticateUserUseCase');
  }

  getSendChatMessageUseCase(): SendChatMessageUseCase {
    return this.resolve('SendChatMessageUseCase');
  }

  getHandlePingMessageUseCase(): HandlePingMessageUseCase {
    return this.resolve('HandlePingMessageUseCase');
  }

  getCheckAuthenticatedConnectionUseCase(): CheckAuthenticatedConnectionUseCase {
    return this.resolve('CheckAuthenticatedConnectionUseCase');
  }

  // Service methods
  getAuthenticationService(): AuthenticationServiceInterface {
    return this.resolve('AuthenticationService');
  }

  getPerformanceMonitoringService(): PerformanceMonitoringService {
    return this.resolve('PerformanceMonitoringService');
  }

  getErrorHandlingService(): ErrorHandlingService {
    return this.resolve('ErrorHandlingService');
  }

  getMetricsService(): MetricsService {
    return this.resolve('MetricsService');
  }

  getCircuitBreakerService(): CircuitBreakerService {
    return this.resolve('CircuitBreakerService');
  }

  createWebSocketMessageService(
    event: WebSocketEvent
  ): WebSocketMessageService {
    const service = this.resolve<WebSocketMessageService>(
      'WebSocketMessageService'
    );
    // Configure service with event context
    if (event) {
      // TODO: Add event-specific configuration
    }
    return service;
  }

  private resolveDependencies(dependencies: Token<unknown>[]): unknown[] {
    return dependencies.map(token => this.resolve(token));
  }

  private registerServices(): void {
    // Register configurations
    this.register<DynamoDBConfig>(
      'DynamoDBConfig',
      class implements DynamoDBConfig {
        tableName: string;
        region: string;
        endpoint?: string;

        constructor() {
          const container = DependencyContainer.prototype;
          this.tableName = container.dynamoDBConfig.tableName;
          this.region = container.dynamoDBConfig.region;
          this.endpoint = container.dynamoDBConfig.endpoint;
        }
      }
    );

    this.register<WebSocketConfig>(
      'WebSocketConfig',
      class implements WebSocketConfig {
        endpoint: string;

        constructor() {
          const container = DependencyContainer.prototype;
          this.endpoint = container.webSocketConfig.endpoint;
        }
      }
    );

    this.register<CloudWatchConfig>(
      'CloudWatchConfig',
      class implements CloudWatchConfig {
        namespace: string;

        constructor() {
          const container = DependencyContainer.prototype;
          this.namespace = container.cloudWatchConfig.namespace;
        }
      }
    );

    // Register repositories with type assertion
    this.register<UserRepository>(
      'UserRepository',
      DynamoDBUserRepository as Constructor<UserRepository>,
      {
        singleton: true,
        dependencies: ['DynamoDBConfig'],
      }
    );

    this.register<ConnectionRepository>(
      'ConnectionRepository',
      DynamoDBConnectionRepository as Constructor<ConnectionRepository>,
      {
        singleton: true,
        dependencies: ['DynamoDBConfig'],
      }
    );

    this.register<MessageRepository>(
      'MessageRepository',
      DynamoDBMessageRepository as Constructor<MessageRepository>,
      {
        singleton: true,
        dependencies: ['DynamoDBConfig'],
      }
    );

    this.register<SessionRepository>(
      'SessionRepository',
      DynamoDBSessionRepository as Constructor<SessionRepository>,
      {
        singleton: true,
        dependencies: ['DynamoDBConfig'],
      }
    );

    // Register services with type assertion
    this.register<WebSocketMessageService>(
      'WebSocketMessageService',
      WebSocketServiceAdapter as Constructor<WebSocketMessageService>,
      {
        singleton: true,
        dependencies: ['WebSocketConfig'],
      }
    );

    this.register<PerformanceMonitoringService>(
      'PerformanceMonitoringService',
      CloudWatchPerformanceMonitoringService as Constructor<PerformanceMonitoringService>,
      {
        singleton: true,
        dependencies: ['CloudWatchConfig'],
      }
    );

    this.register<AuthenticationServiceInterface>(
      'AuthenticationService',
      AuthenticationService as Constructor<AuthenticationServiceInterface>,
      {
        singleton: true,
        dependencies: ['UserRepository', 'ConnectionRepository'],
      }
    );

    this.register<ConnectionService>(
      'ConnectionService',
      ConnectionService as Constructor<ConnectionService>,
      {
        singleton: true,
        dependencies: ['ConnectionRepository'],
      }
    );

    this.register<ConnectionManagementService>(
      'ConnectionManagementService',
      ConnectionManagementService as Constructor<ConnectionManagementService>,
      {
        singleton: true,
        dependencies: ['ConnectionRepository', 'UserRepository'],
      }
    );

    this.register<ErrorHandlingService>(
      'ErrorHandlingService',
      ApplicationErrorHandlingService as Constructor<ErrorHandlingService>,
      {
        singleton: true,
        dependencies: [],
      }
    );

    this.register<MetricsService>(
      'MetricsService',
      CloudWatchMetricsService as Constructor<MetricsService>,
      {
        singleton: true,
        dependencies: [],
      }
    );

    this.register<CircuitBreakerService>(
      'CircuitBreakerService',
      CircuitBreakerServiceImpl as Constructor<CircuitBreakerService>,
      {
        singleton: true,
        dependencies: [],
      }
    );

    this.register<ChatServiceInterface>(
      'ChatService',
      ChatService as Constructor<ChatServiceInterface>,
      {
        singleton: true,
        dependencies: ['MessageRepository'],
      }
    );
  }
}

export const container = new DependencyContainer();

export type Logger = {
  info: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
  debug: (message: string, meta?: Record<string, unknown>) => void;
};

// Use case interfaces
export interface StoreConnectionUseCase {
  execute(command: {
    connectionId: string;
  }): Promise<{ success: boolean; error?: string; errorCode?: string }>;
}

export interface RemoveConnectionUseCase {
  execute(command: {
    connectionId: string;
  }): Promise<{ success: boolean; error?: string; errorCode?: string }>;
}

export interface RemoveAuthenticatedConnectionUseCase {
  execute(command: {
    connectionId: string;
  }): Promise<{ success: boolean; error?: string; errorCode?: string }>;
}

export interface AuthenticateUserUseCase {
  execute(command: { token: string }): Promise<{
    success: boolean;
    error?: string;
    errorCode?: string;
    userId?: string;
    user?: unknown;
  }>;
}

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

export interface HandlePingMessageUseCase {
  execute(command: {
    connectionId: string;
  }): Promise<{ success: boolean; error?: string; errorCode?: string }>;
}

export interface CheckAuthenticatedConnectionUseCase {
  execute(command: { connectionId: string }): Promise<{
    success: boolean;
    error?: string;
    errorCode?: string;
    isAuthenticated?: boolean;
  }>;
}

// Service interfaces
export interface ErrorHandlingService {
  createError(
    type: string,
    message: string,
    code: string,
    details?: Record<string, unknown>,
    correlationId?: string
  ): unknown;
  handleError(error: Error | unknown, context?: ErrorContext): unknown;
  createErrorResponse(error: unknown, event?: unknown): unknown;
  handleWebSocketError(
    error: unknown,
    connectionId: string,
    event: unknown
  ): Promise<void>;
}

export interface MetricsService {
  recordMetric(
    name: string,
    value: number,
    unit?: string,
    dimensions?: Record<string, string>
  ): void;
  recordCount(
    name: string,
    count?: number,
    dimensions?: Record<string, string>
  ): void;
  recordDuration(
    name: string,
    durationMs: number,
    dimensions?: Record<string, string>
  ): void;
  recordError(
    name: string,
    errorType: string,
    dimensions?: Record<string, string>
  ): void;
  recordErrorMetrics(
    errorType: string,
    operation: string,
    additionalDimensions?: Record<string, string>
  ): Promise<void>;
  recordBusinessMetrics(
    metricName: string,
    value: number,
    additionalDimensions?: Record<string, string>
  ): Promise<void>;
  recordWebSocketMetrics(
    event:
      | 'connect'
      | 'disconnect'
      | 'message_sent'
      | 'message_received'
      | 'ping'
      | 'message_processed',
    success: boolean,
    duration?: number,
    errorType?: string
  ): Promise<void>;
  recordDatabaseMetrics(
    operation: string,
    tableName: string,
    success: boolean,
    duration: number,
    errorType?: string
  ): Promise<void>;
  recordAuthenticationMetrics(
    success: boolean,
    duration: number,
    errorType?: string,
    userId?: string
  ): Promise<void>;
  publishMetrics(): Promise<void>;
  getMetrics(filter?: unknown): unknown[];
  clearMetrics(): void;
}

export interface CircuitBreakerService {
  execute<T>(
    serviceName: string,
    operation: string,
    operationFn: () => Promise<T>,
    fallback?: () => Promise<T> | T,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T>;
  getCircuitBreaker(
    serviceName: string,
    operation: string,
    config?: Partial<CircuitBreakerConfig>
  ): unknown;
  getAllStats(): Record<string, unknown>;
  resetAll(): void;
  getCircuitBreakerStats(serviceName: string, operation: string): unknown;
  setDefaultConfig(config: CircuitBreakerConfig): void;
}

export interface WebSocketEvent {
  requestContext: {
    connectionId?: string;
    routeKey?: string;
    [key: string]: unknown;
  };
  body?: string;
  [key: string]: unknown;
}
