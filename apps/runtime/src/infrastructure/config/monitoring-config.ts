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
