import { Logger } from '@awslambdahackathon/types';
import { DomainError } from '@domain/errors/domain-errors';
import { PerformanceMonitoringService } from '@domain/services/performance-monitoring-service';

export interface BaseResult {
  success: boolean;
  error?: string;
  errorCode?: string;
}

export abstract class BaseUseCase<
  TCommand = void,
  TResult extends BaseResult = BaseResult,
> {
  constructor(
    protected readonly logger: Logger,
    protected readonly performanceMonitoringService: PerformanceMonitoringService
  ) {}

  protected handleError(
    error: unknown,
    context?: Record<string, unknown>
  ): TResult {
    if (error instanceof DomainError) {
      this.logger.error('Domain error occurred', {
        error: error.message,
        code: error.code,
        context,
      });
      return {
        success: false,
        error: error.message,
        errorCode: error.code,
      } as TResult;
    }
    if (error instanceof Error) {
      this.logger.error('Application error occurred', {
        error: error.message,
        stack: error.stack,
        context,
      });
      return {
        success: false,
        error: error.message,
        errorCode: 'INTERNAL_ERROR',
      } as TResult;
    }
    this.logger.error('Unknown error occurred', {
      error: String(error),
      context,
    });
    return {
      success: false,
      error: 'An unknown error occurred',
      errorCode: 'INTERNAL_ERROR',
    } as TResult;
  }

  protected abstract execute(command: TCommand): Promise<TResult>;

  protected createSuccessResult(data?: Partial<TResult>): TResult {
    return {
      success: true,
      ...data,
    } as TResult;
  }

  protected createErrorResult(
    error: string,
    errorCode?: string,
    data?: Partial<TResult>
  ): TResult {
    return {
      success: false,
      error,
      errorCode,
      ...data,
    } as TResult;
  }

  protected createFailureResult(
    error: string,
    errorCode?: string,
    data?: Partial<TResult>
  ): TResult {
    return {
      success: false,
      error,
      errorCode,
      ...data,
    } as TResult;
  }
}
