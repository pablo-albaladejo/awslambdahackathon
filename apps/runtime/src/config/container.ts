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
import { CommunicationService } from '@domain/services/communication-service';
import { PerformanceMonitoringService } from '@domain/services/performance-monitoring-service';
import { AwsCloudWatchMetricsAdapter } from '@infrastructure/adapters/outbound/cloudwatch/cloudwatch-metrics-adapter';
import { DynamoDBConnectionRepository } from '@infrastructure/adapters/outbound/dynamodb/dynamodb-connection';
import { DynamoDBMessageRepository } from '@infrastructure/adapters/outbound/dynamodb/dynamodb-message';
import { DynamoDBSessionRepository } from '@infrastructure/adapters/outbound/dynamodb/dynamodb-session';
import { DynamoDBUserRepository } from '@infrastructure/adapters/outbound/dynamodb/dynamodb-user';
import { AwsApiGatewayWebSocketAdapter } from '@infrastructure/adapters/outbound/websocket/aws-api-gateway-adapter';
import { ApplicationErrorHandlingService } from '@infrastructure/services/app-error-handling-service';
import { ChatService } from '@infrastructure/services/chat-service';
import { CircuitBreakerService as CircuitBreakerServiceImpl } from '@infrastructure/services/circuit-breaker-service';
import { CloudWatchMetricsService } from '@infrastructure/services/metrics-service';
import type { APIGatewayProxyEvent } from 'aws-lambda';

import { CloudWatchPerformanceMonitoringService } from '@/infrastructure/services/performance-monitoring-service';

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

export interface WebSocketEvent extends APIGatewayProxyEvent {
  // WebSocket-specific extensions can be added here if needed
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
    return new CloudWatchPerformanceMonitoringService(this.cloudWatchConfig);
  }

  getErrorHandlingService(): ErrorHandlingService {
    return this.resolve('ErrorHandlingService');
  }

  getMetricsService(): MetricsService {
    // Create CloudWatch adapter
    const cloudWatchAdapter = new AwsCloudWatchMetricsAdapter();

    // Create service with adapter
    return new CloudWatchMetricsService(
      cloudWatchAdapter,
      this.cloudWatchConfig.namespace
    );
  }

  getCircuitBreakerService(): CircuitBreakerService {
    return this.resolve('CircuitBreakerService');
  }

  createCommunicationService(event: WebSocketEvent): CommunicationService {
    // Create a new instance for each WebSocket event
    return new AwsApiGatewayWebSocketAdapter(event);
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

    // Note: CommunicationService is created per-request in createCommunicationService method

    this.register<ErrorHandlingService>(
      'ErrorHandlingService',
      ApplicationErrorHandlingService as Constructor<ErrorHandlingService>,
      {
        singleton: true,
        dependencies: [],
      }
    );

    // Note: MetricsService is created per-request in getMetricsService method
    // Note: PerformanceMonitoringService is created per-request in getPerformanceMonitoringService method

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
