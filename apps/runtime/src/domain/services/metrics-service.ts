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

export interface MetricsService
  extends ErrorMetricsRecorder,
    BusinessMetricsRecorder,
    WebSocketMetricsRecorder,
    DatabaseMetricsRecorder,
    AuthenticationMetricsRecorder {}
