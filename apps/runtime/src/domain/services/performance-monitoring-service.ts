export interface PerformanceMonitor {
  complete(success: boolean, requestSize?: number, responseSize?: number): void;
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

export interface PerformanceMonitoringStarter {
  startMonitoring(
    operation: string,
    context: PerformanceContext
  ): PerformanceMonitor;
}

export interface PerformanceMetricsRecorder {
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
}

export interface PerformanceThresholdChecker {
  checkPerformanceThresholds(
    metrics: PerformanceMetrics,
    context: PerformanceContext,
    thresholds: PerformanceThresholds
  ): void;
}

export interface PerformanceStatsProvider {
  getPerformanceStats(): PerformanceStats;
}

export interface PerformanceMonitoringLifecycle {
  flushMetrics(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface PerformanceData {
  operation: string;
  startTime: Date;
  context: PerformanceContext;
  metrics: Partial<PerformanceMetrics>;
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
