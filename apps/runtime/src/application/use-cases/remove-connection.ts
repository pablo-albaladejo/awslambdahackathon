import { BaseResult, BaseUseCase } from '@application/use-cases/base-use-case';
import { Logger } from '@awslambdahackathon/types';
import { PerformanceMonitoringService } from '@domain/services/performance-monitoring-service';
import { ConnectionId } from '@domain/value-objects';
import { ConnectionService } from '@infrastructure/services/connection-service';

interface RemoveConnectionCommand {
  connectionId: string;
}

interface RemoveConnectionResult extends BaseResult {}

export interface RemoveConnectionUseCase {
  execute(command: RemoveConnectionCommand): Promise<RemoveConnectionResult>;
}

export class RemoveConnectionUseCaseImpl
  extends BaseUseCase<RemoveConnectionCommand, RemoveConnectionResult>
  implements RemoveConnectionUseCase
{
  constructor(
    private readonly connectionService: ConnectionService,
    logger: Logger,
    performanceMonitor: PerformanceMonitoringService
  ) {
    super(logger, performanceMonitor);
  }

  async execute(
    command: RemoveConnectionCommand
  ): Promise<RemoveConnectionResult> {
    try {
      this.logger.info('Removing connection', {
        connectionId: command.connectionId,
      });

      if (!command.connectionId) {
        throw new Error('Connection ID is required');
      }

      await this.connectionService.removeConnection({
        connectionId: ConnectionId.create(command.connectionId),
      });

      this.logger.info('Connection removed successfully', {
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
