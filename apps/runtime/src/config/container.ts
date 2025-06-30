import { logger } from '@awslambdahackathon/utils/lambda';
import { AuthenticationService as DomainAuthenticationService } from '@domain/services/authentication-service';
import { ChatService as DomainChatService } from '@domain/services/chat-service';
import { ConnectionService as DomainConnectionService } from '@domain/services/connection-service';
import { AuthenticationService as InfrastructureAuthenticationService } from '@infrastructure/services/authentication-service';
import { ChatService as InfrastructureChatService } from '@infrastructure/services/chat-service';
import { CircuitBreakerService as InfrastructureCircuitBreakerService } from '@infrastructure/services/circuit-breaker-service';
import { ConnectionService as InfrastructureConnectionService } from '@infrastructure/services/connection-service';
import {
  AppError,
  ErrorType,
  ErrorHandlingService as InfrastructureErrorHandlingService,
} from '@infrastructure/services/error-handling-service';
import { MetricsService as InfrastructureMetricsService } from '@infrastructure/services/metrics-service';
import { PerformanceMonitoringService as InfrastructurePerformanceMonitoringService } from '@infrastructure/services/performance-monitoring-service';
import { WebSocketMessageService as InfrastructureWebSocketMessageService } from '@infrastructure/services/websocket-message-service';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// Import domain service interfaces

// Define proper types for the services
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

export interface PerformanceContext {
  operation: string;
  service: string;
  connectionId?: string;
  userId?: string;
  correlationId?: string;
  stage?: string;
  environment?: string;
  eventType?: string;
  tokenLength?: number;
  messageLength?: number;
  [key: string]: unknown;
}

export interface PerformanceMetrics {
  duration: number;
  memoryUsage: number;
  success: boolean;
  errorCount: number;
  [key: string]: unknown;
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
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
}

// Service interfaces for dependency injection - using domain interfaces
export type ConnectionServiceType = DomainConnectionService;
export type ChatServiceType = DomainChatService;
export type AuthenticationServiceType = DomainAuthenticationService;

export interface ErrorHandlingService {
  createError(
    type: ErrorType,
    message: string,
    code: string,
    details?: Record<string, unknown>,
    correlationId?: string
  ): AppError;
  handleError(error: Error | AppError, context?: ErrorContext): AppError;
  createErrorResponse(
    error: AppError,
    event?: APIGatewayProxyEvent
  ): APIGatewayProxyResult;
  handleWebSocketError(
    error: AppError,
    connectionId: string,
    event: APIGatewayProxyEvent
  ): Promise<void>;
}

export interface MetricsService {
  recordErrorMetrics(
    code: string,
    context: string,
    metadata: MetricsMetadata
  ): Promise<void>;
  recordBusinessMetrics(
    name: string,
    value: number,
    metadata: MetricsMetadata
  ): Promise<void>;
  recordWebSocketMetrics(
    name: string,
    success: boolean,
    duration: number,
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
}

export interface WebSocketMessageService {
  sendAuthResponse(
    connectionId: string,
    event: APIGatewayProxyEvent,
    success: boolean,
    data: AuthResponseData
  ): Promise<boolean>;
  sendChatResponse(
    connectionId: string,
    event: APIGatewayProxyEvent,
    message: string,
    sessionId: string,
    isEcho: boolean
  ): Promise<boolean>;
  sendErrorMessage(
    connectionId: string,
    event: APIGatewayProxyEvent,
    message: string
  ): Promise<boolean>;
}

export interface PerformanceMonitoringService {
  startMonitoring(
    operation: string,
    context: PerformanceContext
  ): PerformanceMonitor;
  recordMetrics(metrics: PerformanceMetrics, context: PerformanceContext): void;
  recordBusinessMetric(
    metricName: string,
    value: number,
    unit: string,
    context: PerformanceContext,
    additionalDimensions?: Array<{ Name: string; Value: string }>
  ): void;
  recordErrorMetric(
    errorType: string,
    errorCode: string,
    context: PerformanceContext
  ): void;
  checkPerformanceThresholds(
    metrics: PerformanceMetrics,
    context: PerformanceContext,
    thresholds: PerformanceThresholds
  ): void;
  getPerformanceStats(): PerformanceStats;
  flushMetrics(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface PerformanceMonitor {
  complete(success: boolean, context?: Record<string, unknown>): void;
}

export interface PerformanceThresholds {
  warning: number;
  critical: number;
  timeout: number;
}

export interface PerformanceStats {
  totalMetrics: number;
  bufferSize: number;
  lastFlush: Date | null;
}

export interface CircuitBreakerService {
  execute<T>(
    serviceName: string,
    operation: string,
    operationFn: () => Promise<T>,
    fallback?: () => Promise<T> | T,
    config?: CircuitBreakerConfig
  ): Promise<T>;
  getCircuitBreaker(
    serviceName: string,
    operation: string,
    config?: CircuitBreakerConfig
  ): CircuitBreaker;
  getAllStats(): Record<string, CircuitBreakerStats>;
  resetAll(): void;
  getCircuitBreakerStats(
    serviceName: string,
    operation: string
  ): CircuitBreakerStats;
  setDefaultConfig(config: CircuitBreakerConfig): void;
}

export interface CircuitBreaker {
  execute<T>(fn: () => Promise<T>): Promise<T>;
  getStats(): CircuitBreakerStats;
}

// Dependency injection container
export class Container {
  private static instance: Container;
  private services: Map<string, unknown> = new Map();

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
    // Initialize services
    const connectionService = new InfrastructureConnectionService();
    const authenticationService = new InfrastructureAuthenticationService();
    const chatService = new InfrastructureChatService();
    const errorHandlingService = new InfrastructureErrorHandlingService();
    const metricsService = new InfrastructureMetricsService();
    const websocketMessageService = new InfrastructureWebSocketMessageService();
    const performanceMonitoringService =
      new InfrastructurePerformanceMonitoringService();
    const circuitBreakerService = new InfrastructureCircuitBreakerService();

    // Register services
    logger.info('Registering services in container');
    this.services.set('connectionService', connectionService);
    this.services.set('authenticationService', authenticationService);
    this.services.set('chatService', chatService);
    this.services.set('errorHandlingService', errorHandlingService);
    this.services.set('metricsService', metricsService);
    this.services.set('websocketMessageService', websocketMessageService);
    this.services.set(
      'performanceMonitoringService',
      performanceMonitoringService
    );
    this.services.set('circuitBreakerService', circuitBreakerService);
  }

  public get<T>(serviceName: string): T {
    logger.info('Getting service from container', { serviceName });
    logger.info('All services in container', {
      services: Array.from(this.services.keys()),
    });
    const service = this.services.get(serviceName);
    if (!service) {
      throw new Error(`Service '${serviceName}' not found in container`);
    }
    return service as T;
  }

  public set(serviceName: string, service: unknown): void {
    this.services.set(serviceName, service);
  }

  // Convenience methods for commonly used services
  public getConnectionService(): ConnectionServiceType {
    return this.get<ConnectionServiceType>('connectionService');
  }

  public getAuthenticationService(): AuthenticationServiceType {
    return this.get<AuthenticationServiceType>('authenticationService');
  }

  public getChatService(): ChatServiceType {
    return this.get<ChatServiceType>('chatService');
  }

  public getErrorHandlingService(): ErrorHandlingService {
    return this.get<ErrorHandlingService>('errorHandlingService');
  }

  public getMetricsService(): MetricsService {
    return this.get<MetricsService>('metricsService');
  }

  public getWebSocketMessageService(): WebSocketMessageService {
    return this.get<WebSocketMessageService>('websocketMessageService');
  }

  public getPerformanceMonitoringService(): PerformanceMonitoringService {
    return this.get<PerformanceMonitoringService>(
      'performanceMonitoringService'
    );
  }

  public getCircuitBreakerService(): CircuitBreakerService {
    return this.get<CircuitBreakerService>('circuitBreakerService');
  }
}

// Global container instance
export const container = Container.getInstance();
