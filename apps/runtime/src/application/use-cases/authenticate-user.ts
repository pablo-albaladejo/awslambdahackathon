import { Logger } from '@config/container';
import {
  InvalidTokenException,
  UserAuthenticationFailedException,
} from '@domain/errors/domain-errors';
import {
  AuthenticationResult,
  AuthenticationService,
} from '@domain/services/authentication-service';
import { PerformanceMonitoringService } from '@domain/services/performance-monitoring-service';

import { BaseResult, BaseUseCase } from './base-use-case';

interface AuthenticateUserCommand {
  token: string;
}

interface AuthenticateUserResult extends BaseResult {
  user?: AuthenticationResult['user'];
}

export interface AuthenticateUserUseCase {
  execute(command: AuthenticateUserCommand): Promise<AuthenticateUserResult>;
}

export class AuthenticateUserUseCaseImpl
  extends BaseUseCase<AuthenticateUserCommand, AuthenticateUserResult>
  implements AuthenticateUserUseCase
{
  constructor(
    private readonly authenticationService: AuthenticationService,
    logger: Logger,
    performanceMonitor?: PerformanceMonitoringService
  ) {
    super(logger, performanceMonitor);
  }

  async execute(
    command: AuthenticateUserCommand
  ): Promise<AuthenticateUserResult> {
    try {
      this.logger.info('Authenticating user', {
        tokenLength: command.token?.length,
      });

      if (!command.token) {
        throw new InvalidTokenException('Token is required');
      }

      const result = await this.authenticationService.authenticateUser({
        token: command.token,
      });

      if (result.success) {
        return {
          success: true,
          user: result.user,
        };
      } else {
        throw new UserAuthenticationFailedException(
          result.error || 'Authentication failed',
          result.user?.getUserId()
        );
      }
    } catch (error) {
      return this.handleError(error, {
        tokenLength: command.token?.length,
      });
    }
  }
}
