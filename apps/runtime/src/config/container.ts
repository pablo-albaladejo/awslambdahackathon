import { logger } from '@awslambdahackathon/utils/lambda';
import type { APIGatewayProxyEvent } from 'aws-lambda';

import { authenticationService } from '../services/authentication-service';
import { chatService } from '../services/chat-service';
import { circuitBreakerService } from '../services/circuit-breaker-service';
import { ConnectionService } from '../services/connection-service';
import { errorHandlingService } from '../services/error-handling-service';
import { metricsService } from '../services/metrics-service';
import { performanceMonitoringService } from '../services/performance-monitoring-service';
import { websocketMessageService } from '../services/websocket-message-service';

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
  connectionId: string;
  event: APIGatewayProxyEvent;
  error: Error;
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
}

export interface CircuitBreakerStats {
  state: string;
  failureCount: number;
  successCount: number;
  lastFailureTime?: Date;
  nextAttemptTime?: Date;
}

// Service interfaces for dependency injection
export interface IConnectionService {
  storeConnection(connectionId: string): Promise<void>;
  removeConnection(connectionId: string): Promise<void>;
  getConnection(connectionId: string): Promise<Connection | null>;
}

export interface IAuthenticationService {
  storeAuthenticatedConnection(connectionId: string, user: User): Promise<void>;
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
    error: Error,
    connectionId: string,
    event: APIGatewayProxyEvent
  ): Promise<void>;
}

export interface IMetricsService {
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
    duration: number
  ): Promise<void>;
}

export interface IWebSocketMessageService {
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

export interface IPerformanceMonitoringService {
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

export interface ICircuitBreakerService {
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
    // Register services
    logger.info('Registering authenticationService in container');
    this.services.set('connectionService', new ConnectionService());
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

  public getPerformanceMonitoringService(): IPerformanceMonitoringService {
    return this.get<IPerformanceMonitoringService>(
      'performanceMonitoringService'
    );
  }

  public getCircuitBreakerService(): ICircuitBreakerService {
    return this.get<ICircuitBreakerService>('circuitBreakerService');
  }
}

// Global container instance
export const container = Container.getInstance();
