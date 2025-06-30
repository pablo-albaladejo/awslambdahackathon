import { Logger } from '@config/container';
import { DomainException } from '@domain/errors/domain-errors';
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
    protected readonly performanceMonitor?: PerformanceMonitoringService
  ) {}

  abstract execute(command: TCommand): Promise<TResult>;

  protected handleError(
    error: unknown,
    context: Record<string, unknown> = {}
  ): TResult {
    if (error instanceof DomainException) {
      this.logger.warn(
        `Operation failed with domain exception: ${error.message}`,
        {
          error: error.message,
          code: error.code,
          details: error.details,
          ...context,
        }
      );

      return {
        success: false,
        error: error.message,
        errorCode: error.code,
      } as TResult;
    }

    this.logger.error('Operation failed with unexpected error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      ...context,
    });

    return {
      success: false,
      error: 'Operation failed due to an unexpected error',
      errorCode: 'INTERNAL_ERROR',
    } as TResult;
  }
}
