export interface ErrorContext {
  [key: string]: unknown;
}

export interface ErrorHandlingService {
  createError(
    type: string,
    message: string,
    code: string,
    details?: Record<string, unknown>,
    correlationId?: string
  ): unknown;
  handleError(error: Error | unknown, context?: ErrorContext): unknown;
  createErrorResponse(error: unknown, event?: unknown): unknown;
  handleWebSocketError(
    error: unknown,
    connectionId: string,
    event: unknown
  ): Promise<void>;
}
