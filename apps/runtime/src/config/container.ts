import {
  AuthenticateUserUseCase,
  CheckAuthenticatedConnectionUseCase,
  HandlePingMessageUseCase,
  RemoveAuthenticatedConnectionUseCase,
  RemoveConnectionUseCase,
  SendChatMessageUseCase,
  StoreConnectionUseCase,
} from '@application/interfaces/use-case-interfaces';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ConnectionRepository } from '@domain/repositories/connection';
import { MessageRepository } from '@domain/repositories/message';
import { SessionRepository } from '@domain/repositories/session';
import { UserRepository } from '@domain/repositories/user';
import { AuthenticationService } from '@domain/services/authentication-service';
import { ChatService as ChatServiceInterface } from '@domain/services/chat-service';
import { CircuitBreakerService } from '@domain/services/circuit-breaker-service';
import { CommunicationService } from '@domain/services/communication-service';
import { ErrorHandlingService } from '@domain/services/error-handling-service';
import { MetricsService } from '@domain/services/metrics-service';
import { PerformanceMonitoringService } from '@domain/services/performance-monitoring-service';
import { AwsCloudWatchMetricsAdapter } from '@infrastructure/adapters/outbound/cloudwatch/cloudwatch-metrics-adapter';
import { DynamoDBConnectionRepository } from '@infrastructure/adapters/outbound/dynamodb/dynamodb-connection';
import { DynamoDBMessageRepository } from '@infrastructure/adapters/outbound/dynamodb/dynamodb-message';
import { DynamoDBSessionRepository } from '@infrastructure/adapters/outbound/dynamodb/dynamodb-session';
import { DynamoDBUserRepository } from '@infrastructure/adapters/outbound/dynamodb/dynamodb-user';
import { AwsApiGatewayWebSocketAdapter } from '@infrastructure/adapters/outbound/websocket/aws-api-gateway-adapter';
import { DynamoDBConfig } from '@infrastructure/config/database-config';
import { CloudWatchConfig } from '@infrastructure/config/monitoring-config';
import {
  WebSocketConfig,
  WebSocketEvent,
} from '@infrastructure/config/websocket-config';
import { ApplicationErrorHandlingService } from '@infrastructure/services/app-error-handling-service';
import { ChatService } from '@infrastructure/services/chat-service';
import { CircuitBreakerService as CircuitBreakerServiceImpl } from '@infrastructure/services/circuit-breaker-service';
import { CloudWatchMetricsService } from '@infrastructure/services/metrics-service';
import { CloudWatchPerformanceMonitoringService } from '@infrastructure/services/performance-monitoring-service';

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

class DependencyContainer implements Container {
  private readonly registry = new Map<
    Token,
    { implementation: Constructor; options?: RegistrationOptions }
  >();
  private readonly instances = new Map<Token, unknown>();
  private readonly configs: {
    dynamoDB: DynamoDBConfig;
    webSocket: WebSocketConfig;
    cloudWatch: CloudWatchConfig;
  };

  constructor() {
    // Initialize configurations
    this.configs = {
      dynamoDB: {
        tableName: process.env.DYNAMODB_TABLE_NAME || 'chat-app',
        region: process.env.AWS_REGION || 'us-east-1',
        endpoint: process.env.DYNAMODB_ENDPOINT,
      },
      webSocket: {
        endpoint: process.env.WEBSOCKET_ENDPOINT || '',
      },
      cloudWatch: {
        namespace: process.env.CLOUDWATCH_NAMESPACE || 'chat-app',
      },
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
  getAuthenticationService(): AuthenticationService {
    return this.resolve('AuthenticationService');
  }

  getPerformanceMonitoringService(): PerformanceMonitoringService {
    // Get CloudWatch client from instances
    const cloudWatchClient = this.instances.get(
      'CloudWatchClient'
    ) as CloudWatchClient;
    return new CloudWatchPerformanceMonitoringService(
      cloudWatchClient,
      this.configs.cloudWatch
    );
  }

  getErrorHandlingService(): ErrorHandlingService {
    return this.resolve('ErrorHandlingService');
  }

  getMetricsService(): MetricsService {
    // Get CloudWatch client from instances
    const cloudWatchClient = this.instances.get(
      'CloudWatchClient'
    ) as CloudWatchClient;
    const cloudWatchAdapter = new AwsCloudWatchMetricsAdapter(cloudWatchClient);

    // Create service with adapter
    return new CloudWatchMetricsService(
      cloudWatchAdapter,
      this.configs.cloudWatch.namespace
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
    // Register configurations as singletons - direct instances
    this.instances.set('DynamoDBConfig', this.configs.dynamoDB);
    this.instances.set('WebSocketConfig', this.configs.webSocket);
    this.instances.set('CloudWatchConfig', this.configs.cloudWatch);

    // Register AWS clients as singletons
    const dynamoDBClient = new DynamoDBClient({
      region: this.configs.dynamoDB.region,
      ...(this.configs.dynamoDB.endpoint && {
        endpoint: this.configs.dynamoDB.endpoint,
      }),
    });
    const dynamoDBDocClient = DynamoDBDocumentClient.from(dynamoDBClient);
    const cloudWatchClient = new CloudWatchClient({
      region: this.configs.dynamoDB.region,
    });

    this.instances.set('DynamoDBClient', dynamoDBClient);
    this.instances.set('DynamoDBDocumentClient', dynamoDBDocClient);
    this.instances.set('CloudWatchClient', cloudWatchClient);

    // Register repositories with AWS client injection
    this.register<UserRepository>(
      'UserRepository',
      DynamoDBUserRepository as Constructor<UserRepository>,
      {
        singleton: true,
        dependencies: ['DynamoDBDocumentClient', 'DynamoDBConfig'],
      }
    );

    this.register<ConnectionRepository>(
      'ConnectionRepository',
      DynamoDBConnectionRepository as Constructor<ConnectionRepository>,
      {
        singleton: true,
        dependencies: ['DynamoDBDocumentClient', 'DynamoDBConfig'],
      }
    );

    this.register<MessageRepository>(
      'MessageRepository',
      DynamoDBMessageRepository as Constructor<MessageRepository>,
      {
        singleton: true,
        dependencies: ['DynamoDBDocumentClient', 'DynamoDBConfig'],
      }
    );

    this.register<SessionRepository>(
      'SessionRepository',
      DynamoDBSessionRepository as Constructor<SessionRepository>,
      {
        singleton: true,
        dependencies: ['DynamoDBDocumentClient', 'DynamoDBConfig'],
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
