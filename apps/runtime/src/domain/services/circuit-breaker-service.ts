import { CircuitBreakerConfig } from '@infrastructure/config/monitoring-config';

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
