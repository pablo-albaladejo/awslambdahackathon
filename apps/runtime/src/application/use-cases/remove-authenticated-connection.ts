import { BaseResult, BaseUseCase } from '@application/use-cases/base-use-case';
import { Logger } from '@awslambdahackathon/types';
import { AuthenticationService } from '@domain/services/authentication-service';
import { PerformanceMonitoringService } from '@domain/services/performance-monitoring-service';
import { ConnectionId } from '@domain/value-objects';

interface RemoveAuthenticatedConnectionCommand {
  connectionId: string;
}

interface RemoveAuthenticatedConnectionResult extends BaseResult {}

export interface RemoveAuthenticatedConnectionUseCase {
  execute(
    command: RemoveAuthenticatedConnectionCommand
  ): Promise<RemoveAuthenticatedConnectionResult>;
}

export class RemoveAuthenticatedConnectionUseCaseImpl
  extends BaseUseCase<
    RemoveAuthenticatedConnectionCommand,
    RemoveAuthenticatedConnectionResult
  >
  implements RemoveAuthenticatedConnectionUseCase
{
  constructor(
    private readonly authenticationService: AuthenticationService,
    logger: Logger,
    performanceMonitor: PerformanceMonitoringService
  ) {
    super(logger, performanceMonitor);
  }

  async execute(
    command: RemoveAuthenticatedConnectionCommand
  ): Promise<RemoveAuthenticatedConnectionResult> {
    try {
      this.logger.info('Removing authenticated connection', {
        connectionId: command.connectionId,
      });

      if (!command.connectionId) {
        throw new Error('Connection ID is required');
      }

      await this.authenticationService.removeAuthenticatedConnection(
        ConnectionId.create(command.connectionId)
      );

      this.logger.info('Authenticated connection removed successfully', {
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
