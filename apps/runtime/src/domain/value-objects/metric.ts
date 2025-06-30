export type MetricType =
  | 'span'
  | 'operation'
  | 'business'
  | 'error'
  | 'threshold'
  | 'duration'
  | 'memory'
  | 'success';

export interface Metric {
  name: string;
  type: MetricType;
  tags: Record<string, string>;
  value?: number;
  unit?: string;
  duration?: number;
  success?: boolean;
  error?: string;
  timestamp?: number;
}

export interface PerformanceMetric extends Metric {
  type: 'operation';
  duration: number;
  memoryUsage: number;
  success: boolean;
  errorCount: number;
  externalCalls?: number;
  databaseCalls?: number;
  requestSize?: number;
  responseSize?: number;
}
