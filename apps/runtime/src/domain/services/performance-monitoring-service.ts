import { Metric } from '@domain/value-objects/metric';

export interface PerformanceMonitor {
  complete(success: boolean, requestSize?: number, responseSize?: number): void;
}

export interface PerformanceContext {
  [key: string]: string | number | boolean | undefined;
}

export interface PerformanceMetrics {
  duration: number;
  memoryUsage: number;
  success: boolean;
  errorCount: number;
  externalCalls?: number;
  databaseCalls?: number;
  requestSize?: number;
  responseSize?: number;
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
  metrics: PerformanceMetrics;
}

export interface PerformanceMonitoringService {
  /**
   * Records metrics for a monitored operation
   * @param metric The metric to record
   * @param namespace Optional namespace for the metric
   */
  recordMetrics(metric: Metric, namespace?: string): Promise<void>;

  /**
   * Starts a new monitoring span
   * @param name The name of the span
   * @param tags Additional tags for the span
   */
  startSpan(name: string, tags?: Record<string, string>): Promise<void>;

  /**
   * Ends the current monitoring span
   * @param error Optional error if the span failed
   */
  endSpan(error?: Error): Promise<void>;

  startMonitoring(
    operation: string,
    context: PerformanceContext
  ): {
    complete(
      success: boolean,
      requestSize?: number,
      responseSize?: number
    ): void;
  };
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
  flushMetrics(namespace?: string): Promise<void>;
  shutdown(): Promise<void>;
}
