import { Logger } from '@config/container';
import { PerformanceMonitoringService } from '@domain/services/performance-monitoring-service';
import { ConnectionId } from '@domain/value-objects';
import { ConnectionService } from '@infrastructure/services/connection-service';

import { BaseResult, BaseUseCase } from './base-use-case';

interface StoreConnectionCommand {
  connectionId: string;
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
