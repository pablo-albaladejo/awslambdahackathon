import { BaseResult, BaseUseCase } from '@application/use-cases/base-use-case';
import { Logger } from '@config/container';
import { DomainError } from '@domain/errors/domain-errors';
import { PerformanceMonitoringService } from '@domain/services/performance-monitoring-service';
import { AuthenticationService } from '@infrastructure/services/authentication-service';

export interface AuthenticateUserCommand {
  token: string;
}

export interface AuthenticateUserResult extends BaseResult {
  userId?: string;
}

export class AuthenticateUserUseCase extends BaseUseCase<
  AuthenticateUserCommand,
  AuthenticateUserResult
> {
  constructor(
    private readonly authService: AuthenticationService,
    logger: Logger,
    performanceMonitoringService: PerformanceMonitoringService
  ) {
    super(logger, performanceMonitoringService);
  }

  async execute(
    command: AuthenticateUserCommand
  ): Promise<AuthenticateUserResult> {
    try {
      if (!command.token) {
        throw new DomainError('Token is required', 'VALIDATION_ERROR');
      }

      const authResult = await this.authService.authenticateUser({
        token: command.token,
      });

      if (!authResult.success || !authResult.user) {
        return {
          success: false,
          error: authResult.error || 'Authentication failed',
          errorCode: 'AUTHENTICATION_FAILED',
        };
      }

      return {
        success: true,
        userId: authResult.user.getUserId(),
      };
    } catch (error) {
      return this.handleError(error, {
        hasToken: !!command.token,
      });
    }
  }
}
