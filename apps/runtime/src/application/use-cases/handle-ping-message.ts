import { BaseResult, BaseUseCase } from '@application/use-cases/base-use-case';
import { Logger } from '@config/container';
import { PerformanceMonitoringService } from '@domain/services/performance-monitoring-service';

interface HandlePingMessageCommand {
  connectionId: string;
}

interface HandlePingMessageResult extends BaseResult {}

export interface HandlePingMessageUseCase {
  execute(command: HandlePingMessageCommand): Promise<HandlePingMessageResult>;
}

export class HandlePingMessageUseCaseImpl
  extends BaseUseCase<HandlePingMessageCommand, HandlePingMessageResult>
  implements HandlePingMessageUseCase
{
  constructor(
    logger: Logger,
    performanceMonitor: PerformanceMonitoringService
  ) {
    super(logger, performanceMonitor);
  }

  async execute(
    command: HandlePingMessageCommand
  ): Promise<HandlePingMessageResult> {
    try {
      this.logger.info('Received ping message', {
        connectionId: command.connectionId,
      });

      // Optionally, add domain logic here if needed
      // For example, update connection activity timestamp

      return { success: true };
    } catch (error) {
      return this.handleError(error, {
        connectionId: command.connectionId,
      });
    }
  }
}
