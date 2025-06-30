import { DomainError } from '@awslambdahackathon/types';
import { logger } from '@awslambdahackathon/utils/lambda';

/**
 * Base class for all infrastructure adapters with standardized error handling
 */
export abstract class BaseAdapter {
  protected readonly logger = logger;
  private correlationIdCounter = 0;

  /**
   * Generate a unique correlation ID for error tracking
   */
  protected generateCorrelationId(): string {
    return `${Date.now()}-${++this.correlationIdCounter}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Standardized error handling for all infrastructure operations
   */
  protected handleInfrastructureError(
    operation: string,
    service: string,
    error: unknown,
    context?: Record<string, unknown>
  ): never {
    const correlationId = this.generateCorrelationId();
    const errorMessage = `${service} ${operation} failed`;

    // Log with consistent format
    this.logger.error(errorMessage, {
      service,
      operation,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context,
      correlationId,
      timestamp: new Date().toISOString(),
    });

    // Throw consistent domain error
    throw new DomainError(
      errorMessage,
      'INTERNAL_ERROR',
      {
        originalError: error instanceof Error ? error.message : String(error),
        originalStack: error instanceof Error ? error.stack : undefined,
        service,
        operation,
        ...context,
      },
      correlationId
    );
  }

  /**
   * Execute operation with consistent error handling
   */
  protected async executeWithErrorHandling<T>(
    operation: string,
    service: string,
    operationFn: () => Promise<T>,
    context?: Record<string, unknown>
  ): Promise<T> {
    try {
      const startTime = Date.now();
      const result = await operationFn();
      const duration = Date.now() - startTime;

      // Log successful operations for observability
      this.logger.debug(`${service} ${operation} completed successfully`, {
        service,
        operation,
        duration,
        context,
      });

      return result;
    } catch (error) {
      this.handleInfrastructureError(operation, service, error, context);
    }
  }

  /**
   * Execute sync operation with consistent error handling
   */
  protected executeWithErrorHandlingSync<T>(
    operation: string,
    service: string,
    operationFn: () => T,
    context?: Record<string, unknown>
  ): T {
    try {
      const startTime = Date.now();
      const result = operationFn();
      const duration = Date.now() - startTime;

      // Log successful operations for observability
      this.logger.debug(`${service} ${operation} completed successfully`, {
        service,
        operation,
        duration,
        context,
      });

      return result;
    } catch (error) {
      this.handleInfrastructureError(operation, service, error, context);
    }
  }
}
