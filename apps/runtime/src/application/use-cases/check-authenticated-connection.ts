import { Logger } from '@config/container';
import { AuthenticationService } from '@domain/services/authentication-service';
import { PerformanceMonitoringService } from '@domain/services/performance-monitoring-service';
import { ConnectionId } from '@domain/value-objects';

import { BaseResult, BaseUseCase } from './base-use-case';

interface CheckAuthenticatedConnectionCommand {
  connectionId: string;
}

interface CheckAuthenticatedConnectionResult extends BaseResult {
  isAuthenticated?: boolean;
}

export interface CheckAuthenticatedConnectionUseCase {
  execute(
    command: CheckAuthenticatedConnectionCommand
  ): Promise<CheckAuthenticatedConnectionResult>;
}

export class CheckAuthenticatedConnectionUseCaseImpl
  extends BaseUseCase<
    CheckAuthenticatedConnectionCommand,
    CheckAuthenticatedConnectionResult
  >
  implements CheckAuthenticatedConnectionUseCase
{
  constructor(
    private readonly authenticationService: AuthenticationService,
    logger: Logger,
    performanceMonitor: PerformanceMonitoringService
  ) {
    super(logger, performanceMonitor);
  }

  async execute(
    command: CheckAuthenticatedConnectionCommand
  ): Promise<CheckAuthenticatedConnectionResult> {
    try {
      this.logger.info('Checking if connection is authenticated', {
        connectionId: command.connectionId,
      });

      if (!command.connectionId) {
        throw new Error('Connection ID is required');
      }

      const isAuthenticated =
        await this.authenticationService.isConnectionAuthenticated(
          ConnectionId.create(command.connectionId)
        );

      this.logger.info('Connection authentication check completed', {
        connectionId: command.connectionId,
        isAuthenticated,
      });

      return {
        success: true,
        isAuthenticated,
      };
    } catch (error) {
      return this.handleError(error, {
        connectionId: command.connectionId,
      });
    }
  }
}
