import { logger } from '@awslambdahackathon/utils/lambda';

export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Circuit is open, requests fail fast
  HALF_OPEN = 'HALF_OPEN', // Testing if service is back up
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening circuit
  recoveryTimeout: number; // Time in ms to wait before trying again
  expectedResponseTime: number; // Expected response time in ms
  monitoringWindow: number; // Time window for failure counting
  minimumRequestCount: number; // Minimum requests before circuit can open
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  nextAttemptTime: Date | null;
  failureRate: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private nextAttemptTime: Date | null = null;
  private requestTimes: Array<{ timestamp: Date; duration: number }> = [];

  constructor(
    private readonly serviceName: string,
    private readonly operation: string,
    private readonly config: CircuitBreakerConfig
  ) {}

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    operation: () => Promise<T>,
    fallback?: () => Promise<T> | T
  ): Promise<T> {
    if (!this.canExecute()) {
      logger.warn('Circuit breaker is open, failing fast', {
        service: this.serviceName,
        operation: this.operation,
        state: this.state,
        nextAttemptTime: this.nextAttemptTime,
      });

      if (fallback) {
        try {
          return await fallback();
        } catch (fallbackError) {
          logger.error('Fallback operation also failed', {
            service: this.serviceName,
            operation: this.operation,
            fallbackError:
              fallbackError instanceof Error
                ? fallbackError.message
                : String(fallbackError),
          });
          throw fallbackError;
        }
      }

      throw new Error(
        `Circuit breaker is open for ${this.serviceName}:${this.operation}`
      );
    }

    const startTime = Date.now();

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    } finally {
      const duration = Date.now() - startTime;
      this.recordRequestTime(duration);
    }
  }

  /**
   * Check if the circuit breaker allows execution
   */
  private canExecute(): boolean {
    switch (this.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        if (
          this.nextAttemptTime &&
          Date.now() >= this.nextAttemptTime.getTime()
        ) {
          this.transitionToHalfOpen();
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        return true;

      default:
        return false;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    this.successCount++;
    this.lastSuccessTime = new Date();

    if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToClosed();
    }

    logger.debug('Circuit breaker operation succeeded', {
      service: this.serviceName,
      operation: this.operation,
      state: this.state,
      successCount: this.successCount,
      failureCount: this.failureCount,
    });
  }

  /**
   * Handle failed operation
   */
  private onFailure(error: unknown): void {
    this.failureCount++;
    this.lastFailureTime = new Date();

    logger.warn('Circuit breaker operation failed', {
      service: this.serviceName,
      operation: this.operation,
      error: error instanceof Error ? error.message : String(error),
      failureCount: this.failureCount,
      threshold: this.config.failureThreshold,
    });

    if (this.shouldOpenCircuit()) {
      this.transitionToOpen();
    }
  }

  /**
   * Determine if circuit should open
   */
  private shouldOpenCircuit(): boolean {
    const totalRequests = this.successCount + this.failureCount;

    // Need minimum requests before opening circuit
    if (totalRequests < this.config.minimumRequestCount) {
      return false;
    }

    // Check failure threshold
    if (this.failureCount >= this.config.failureThreshold) {
      return true;
    }

    // Check failure rate in monitoring window
    const now = Date.now();
    const windowStart = now - this.config.monitoringWindow;

    const recentFailures = this.requestTimes
      .filter(req => req.timestamp.getTime() >= windowStart)
      .filter(req => req.duration > this.config.expectedResponseTime).length;

    const recentRequests = this.requestTimes.filter(
      req => req.timestamp.getTime() >= windowStart
    ).length;

    if (recentRequests > 0) {
      const failureRate = recentFailures / recentRequests;
      return failureRate > 0.5; // 50% failure rate threshold
    }

    return false;
  }

  /**
   * Transition to open state
   */
  private transitionToOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);

    logger.error('Circuit breaker opened', {
      service: this.serviceName,
      operation: this.operation,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttemptTime: this.nextAttemptTime,
    });
  }

  /**
   * Transition to half-open state
   */
  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.nextAttemptTime = null;

    logger.info('Circuit breaker transitioning to half-open', {
      service: this.serviceName,
      operation: this.operation,
    });
  }

  /**
   * Transition to closed state
   */
  private transitionToClosed(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.nextAttemptTime = null;

    logger.info('Circuit breaker closed', {
      service: this.serviceName,
      operation: this.operation,
    });
  }

  /**
   * Record request time for monitoring
   */
  private recordRequestTime(duration: number): void {
    const now = new Date();
    this.requestTimes.push({ timestamp: now, duration });

    // Keep only recent requests within monitoring window
    const cutoffTime = now.getTime() - this.config.monitoringWindow;
    this.requestTimes = this.requestTimes.filter(
      req => req.timestamp.getTime() >= cutoffTime
    );
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    const totalRequests = this.successCount + this.failureCount;
    const failureRate =
      totalRequests > 0 ? this.failureCount / totalRequests : 0;

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime,
      failureRate,
    };
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.nextAttemptTime = null;
    this.requestTimes = [];

    logger.info('Circuit breaker reset', {
      service: this.serviceName,
      operation: this.operation,
    });
  }

  /**
   * Force circuit breaker to open state
   */
  forceOpen(): void {
    this.transitionToOpen();
  }
}

export class CircuitBreakerService {
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private defaultConfig: CircuitBreakerConfig = {
    failureThreshold: 5,
    recoveryTimeout: 30000, // 30 seconds
    expectedResponseTime: 5000, // 5 seconds
    monitoringWindow: 60000, // 1 minute
    minimumRequestCount: 10,
  };

  /**
   * Get or create a circuit breaker for a service operation
   */
  getCircuitBreaker(
    serviceName: string,
    operation: string,
    config?: Partial<CircuitBreakerConfig>
  ): CircuitBreaker {
    const key = `${serviceName}:${operation}`;

    if (!this.circuitBreakers.has(key)) {
      const fullConfig = { ...this.defaultConfig, ...config };
      const circuitBreaker = new CircuitBreaker(
        serviceName,
        operation,
        fullConfig
      );
      this.circuitBreakers.set(key, circuitBreaker);
    }

    return this.circuitBreakers.get(key)!;
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(
    serviceName: string,
    operation: string,
    operationFn: () => Promise<T>,
    fallback?: () => Promise<T> | T,
    config?: Partial<CircuitBreakerConfig>
  ): Promise<T> {
    const circuitBreaker = this.getCircuitBreaker(
      serviceName,
      operation,
      config
    );
    return circuitBreaker.execute(operationFn, fallback);
  }

  /**
   * Get statistics for all circuit breakers
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};

    for (const [key, circuitBreaker] of this.circuitBreakers.entries()) {
      stats[key] = circuitBreaker.getStats();
    }

    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const circuitBreaker of this.circuitBreakers.values()) {
      circuitBreaker.reset();
    }
  }

  /**
   * Get circuit breaker for a specific service operation
   */
  getCircuitBreakerStats(
    serviceName: string,
    operation: string
  ): CircuitBreakerStats | null {
    const key = `${serviceName}:${operation}`;
    const circuitBreaker = this.circuitBreakers.get(key);
    return circuitBreaker ? circuitBreaker.getStats() : null;
  }

  /**
   * Set default configuration for new circuit breakers
   */
  setDefaultConfig(config: CircuitBreakerConfig): void {
    this.defaultConfig = { ...this.defaultConfig, ...config };
  }
}
