export interface MetricData {
  name: string;
  value: number;
  unit?: string;
  timestamp?: Date;
  dimensions?: Record<string, string>;
}

export interface MetricFilter {
  name?: string;
  startTime?: Date;
  endTime?: Date;
  dimensions?: Record<string, string>;
}

export interface ErrorMetricsRecorder {
  recordErrorMetrics(
    errorType: string,
    operation: string,
    additionalDimensions?: Record<string, string>
  ): Promise<void>;
}

export interface BusinessMetricsRecorder {
  recordBusinessMetrics(
    metricName: string,
    value: number,
    additionalDimensions?: Record<string, string>
  ): Promise<void>;
}

export interface WebSocketMetricsRecorder {
  recordWebSocketMetrics(
    event:
      | 'connect'
      | 'disconnect'
      | 'message_sent'
      | 'message_received'
      | 'ping'
      | 'message_processed',
    success: boolean,
    duration?: number,
    errorType?: string
  ): Promise<void>;
}

export interface DatabaseMetricsRecorder {
  recordDatabaseMetrics(
    operation: string,
    tableName: string,
    success: boolean,
    duration: number,
    errorType?: string
  ): Promise<void>;
}

export interface AuthenticationMetricsRecorder {
  recordAuthenticationMetrics(
    success: boolean,
    duration: number,
    errorType?: string,
    userId?: string
  ): Promise<void>;
}

export interface MetricsService {
  recordMetric(
    name: string,
    value: number,
    unit?: string,
    dimensions?: Record<string, string>
  ): void;
  recordCount(
    name: string,
    count?: number,
    dimensions?: Record<string, string>
  ): void;
  recordDuration(
    name: string,
    durationMs: number,
    dimensions?: Record<string, string>
  ): void;
  recordError(
    name: string,
    errorType: string,
    dimensions?: Record<string, string>
  ): void;
  recordErrorMetrics(
    errorType: string,
    operation: string,
    additionalDimensions?: Record<string, string>
  ): Promise<void>;
  recordBusinessMetrics(
    metricName: string,
    value: number,
    additionalDimensions?: Record<string, string>
  ): Promise<void>;
  recordWebSocketMetrics(
    event:
      | 'connect'
      | 'disconnect'
      | 'message_sent'
      | 'message_received'
      | 'ping'
      | 'message_processed',
    success: boolean,
    duration?: number,
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
  publishMetrics(): Promise<void>;
  getMetrics(filter?: unknown): unknown[];
  clearMetrics(): void;
}
