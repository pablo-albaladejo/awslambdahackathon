import { BaseResult, BaseUseCase } from '@application/use-cases/base-use-case';
import { Logger } from '@awslambdahackathon/types';
import { PerformanceMonitoringService } from '@domain/services/performance-monitoring-service';
import { ConnectionId, SessionId } from '@domain/value-objects';
import { ConnectionService } from '@infrastructure/services/connection-service';

interface StoreConnectionCommand {
  connectionId: string;
  sessionId?: string;
}

interface StoreConnectionResult extends BaseResult {}

export interface StoreConnectionUseCase {
  execute(command: StoreConnectionCommand): Promise<StoreConnectionResult>;
}

export class StoreConnectionUseCaseImpl
  extends BaseUseCase<StoreConnectionCommand, StoreConnectionResult>
  implements StoreConnectionUseCase
{
  constructor(
    private readonly connectionService: ConnectionService,
    logger: Logger,
    performanceMonitor: PerformanceMonitoringService
  ) {
    super(logger, performanceMonitor);
  }

  async execute(
    command: StoreConnectionCommand
  ): Promise<StoreConnectionResult> {
    try {
      this.logger.info('Storing connection', {
        connectionId: command.connectionId,
      });

      if (!command.connectionId) {
        throw new Error('Connection ID is required');
      }

      await this.connectionService.storeConnection({
        connectionId: ConnectionId.create(command.connectionId),
        sessionId: command.sessionId
          ? SessionId.create(command.sessionId)
          : undefined,
      });

      this.logger.info('Connection stored successfully', {
        connectionId: command.connectionId,
      });

      return {
        success: true,
      };
    } catch (error) {
      return this.handleError(error, {
        connectionId: command.connectionId,
      });
    }
  }
}
