import {
  AuthenticateUserUseCase,
  CheckAuthenticatedConnectionUseCase,
  HandlePingMessageUseCase,
  RemoveAuthenticatedConnectionUseCase,
  RemoveConnectionUseCase,
  SendChatMessageUseCase,
  StoreConnectionUseCase,
} from '@application/interfaces/use-case-interfaces';
// Use case implementations
import { AuthenticateUserUseCase as AuthenticateUserUseCaseImpl } from '@application/use-cases/authenticate-user';
import { CheckAuthenticatedConnectionUseCaseImpl } from '@application/use-cases/check-authenticated-connection';
import { HandlePingMessageUseCaseImpl } from '@application/use-cases/handle-ping-message';
import { RemoveAuthenticatedConnectionUseCaseImpl } from '@application/use-cases/remove-authenticated-connection';
import { RemoveConnectionUseCaseImpl } from '@application/use-cases/remove-connection';
import { SendChatMessageUseCaseImpl } from '@application/use-cases/send-chat-message';
import { StoreConnectionUseCaseImpl } from '@application/use-cases/store-connection';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
// AWS Lambda Powertools unified service
import { loggerAdapter } from '@awslambdahackathon/utils/lambda';
// WebSocket Lambda configuration
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
import { DynamoDBUserMapper } from '@infrastructure/mappers/database/dynamodb-user.mapper';
import { ApplicationErrorHandlingService } from '@infrastructure/services/app-error-handling-service';
import { AuthenticationService as AuthenticationServiceImpl } from '@infrastructure/services/authentication-service';
import { ChatService } from '@infrastructure/services/chat-service';
import { CircuitBreakerService as CircuitBreakerServiceImpl } from '@infrastructure/services/circuit-breaker-service';
import { ConnectionService } from '@infrastructure/services/connection-service';
import { CloudWatchMetricsService } from '@infrastructure/services/metrics-service';
import { CloudWatchPerformanceMonitoringService } from '@infrastructure/services/performance-monitoring-service';

import { validateWebSocketRequiredEnvironmentVariables } from './websocket-lambda-config';

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
    connectionsDB: DynamoDBConfig;
    messagesDB: DynamoDBConfig;
    webSocket: WebSocketConfig;
    cloudWatch: CloudWatchConfig;
  };

  constructor() {
    // Validate required environment variables using WebSocket-specific validation
    validateWebSocketRequiredEnvironmentVariables();

    // Initialize separate configurations for connections and messages
    this.configs = {
      connectionsDB: {
        tableName: process.env.WEBSOCKET_CONNECTIONS_TABLE!,
        region: process.env.AWS_REGION!,
      },
      messagesDB: {
        tableName: process.env.WEBSOCKET_MESSAGES_TABLE!,
        region: process.env.AWS_REGION!,
      },
      webSocket: {
        endpoint: process.env.WEBSOCKET_ENDPOINT!,
      },
      cloudWatch: {
        namespace: process.env.CLOUDWATCH_NAMESPACE!,
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
    // First check if there's a direct instance (for AWS clients, configs, etc.)
    const directInstance = this.instances.get(token);
    if (directInstance) {
      return directInstance as T;
    }

    // Then check for registered services
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

  createCommunicationService(event: WebSocketEvent): CommunicationService {
    // Create a new instance for each WebSocket event
    return new AwsApiGatewayWebSocketAdapter(event);
  }

  private resolveDependencies(dependencies: Token<unknown>[]): unknown[] {
    return dependencies.map(token => this.resolve(token));
  }

  private registerServices(): void {
    // Register configurations as singletons - direct instances
    this.instances.set('ConnectionsDBConfig', this.configs.connectionsDB);
    this.instances.set('MessagesDBConfig', this.configs.messagesDB);
    this.instances.set('WebSocketConfig', this.configs.webSocket);
    this.instances.set('CloudWatchConfig', this.configs.cloudWatch);

    // Register AWS clients as singletons
    const dynamoDBClient = new DynamoDBClient({
      region: this.configs.connectionsDB.region, // Use region from connections config
    });
    const dynamoDBDocClient = DynamoDBDocumentClient.from(dynamoDBClient);
    const cloudWatchClient = new CloudWatchClient({
      region: this.configs.connectionsDB.region, // Use region from connections config
    });

    this.instances.set('DynamoDBClient', dynamoDBClient);
    this.instances.set('DynamoDBDocumentClient', dynamoDBDocClient);
    this.instances.set('CloudWatchClient', cloudWatchClient);

    // Register repositories with correct table configurations
    this.register<UserRepository>(
      'UserRepository',
      DynamoDBUserRepository as Constructor<UserRepository>,
      {
        singleton: true,
        dependencies: ['DynamoDBDocumentClient', 'DynamoDBUserMapper'],
      }
    );

    this.register<ConnectionRepository>(
      'ConnectionRepository',
      DynamoDBConnectionRepository as Constructor<ConnectionRepository>,
      {
        singleton: true,
        dependencies: ['DynamoDBDocumentClient', 'ConnectionsDBConfig'],
      }
    );

    this.register<MessageRepository>(
      'MessageRepository',
      DynamoDBMessageRepository as Constructor<MessageRepository>,
      {
        singleton: true,
        dependencies: ['DynamoDBDocumentClient', 'MessagesDBConfig'],
      }
    );

    this.register<SessionRepository>(
      'SessionRepository',
      DynamoDBSessionRepository as Constructor<SessionRepository>,
      {
        singleton: true,
        dependencies: ['DynamoDBDocumentClient', 'MessagesDBConfig'],
      }
    );

    // Register mappers as singletons
    this.register<DynamoDBUserMapper>(
      'DynamoDBUserMapper',
      DynamoDBUserMapper as Constructor<DynamoDBUserMapper>,
      {
        singleton: true,
        dependencies: [],
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

    // MetricsService and PerformanceMonitoringService are now properly registered below

    this.register<PerformanceMonitoringService>(
      'PerformanceMonitoringService',
      CloudWatchPerformanceMonitoringService as Constructor<PerformanceMonitoringService>,
      {
        singleton: true,
        dependencies: ['CloudWatchClient', 'CloudWatchConfig'],
      }
    );

    this.register<AwsCloudWatchMetricsAdapter>(
      'CloudWatchMetricsAdapter',
      AwsCloudWatchMetricsAdapter as Constructor<AwsCloudWatchMetricsAdapter>,
      {
        singleton: true,
        dependencies: ['CloudWatchClient'],
      }
    );

    this.register<MetricsService>(
      'MetricsService',
      CloudWatchMetricsService as Constructor<MetricsService>,
      {
        singleton: true,
        dependencies: ['CloudWatchMetricsAdapter'],
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

    // Register Logger adapter as singleton
    this.instances.set('Logger', loggerAdapter);

    // Register Services
    this.register<ConnectionService>(
      'ConnectionService',
      ConnectionService as Constructor<ConnectionService>,
      {
        singleton: true,
        dependencies: [],
      }
    );

    this.register<AuthenticationService>(
      'AuthenticationService',
      AuthenticationServiceImpl as Constructor<AuthenticationService>,
      {
        singleton: true,
        dependencies: [],
      }
    );

    // Register Use Cases
    this.register<StoreConnectionUseCase>(
      'StoreConnectionUseCase',
      StoreConnectionUseCaseImpl as Constructor<StoreConnectionUseCase>,
      {
        singleton: false,
        dependencies: [
          'ConnectionService',
          'Logger',
          'PerformanceMonitoringService',
        ],
      }
    );

    this.register<RemoveConnectionUseCase>(
      'RemoveConnectionUseCase',
      RemoveConnectionUseCaseImpl as Constructor<RemoveConnectionUseCase>,
      {
        singleton: false,
        dependencies: [
          'ConnectionService',
          'Logger',
          'PerformanceMonitoringService',
        ],
      }
    );

    this.register<AuthenticateUserUseCase>(
      'AuthenticateUserUseCase',
      AuthenticateUserUseCaseImpl as Constructor<AuthenticateUserUseCase>,
      {
        singleton: false,
        dependencies: [
          'AuthenticationService',
          'Logger',
          'PerformanceMonitoringService',
        ],
      }
    );

    this.register<SendChatMessageUseCase>(
      'SendChatMessageUseCase',
      SendChatMessageUseCaseImpl as Constructor<SendChatMessageUseCase>,
      {
        singleton: false,
        dependencies: ['ChatService', 'Logger', 'PerformanceMonitoringService'],
      }
    );

    this.register<HandlePingMessageUseCase>(
      'HandlePingMessageUseCase',
      HandlePingMessageUseCaseImpl as Constructor<HandlePingMessageUseCase>,
      {
        singleton: false,
        dependencies: ['Logger', 'PerformanceMonitoringService'],
      }
    );

    this.register<CheckAuthenticatedConnectionUseCase>(
      'CheckAuthenticatedConnectionUseCase',
      CheckAuthenticatedConnectionUseCaseImpl as Constructor<CheckAuthenticatedConnectionUseCase>,
      {
        singleton: false,
        dependencies: [
          'AuthenticationService',
          'Logger',
          'PerformanceMonitoringService',
        ],
      }
    );

    this.register<RemoveAuthenticatedConnectionUseCase>(
      'RemoveAuthenticatedConnectionUseCase',
      RemoveAuthenticatedConnectionUseCaseImpl as Constructor<RemoveAuthenticatedConnectionUseCase>,
      {
        singleton: false,
        dependencies: [
          'AuthenticationService',
          'Logger',
          'PerformanceMonitoringService',
        ],
      }
    );
  }
}

export const container = new DependencyContainer();
