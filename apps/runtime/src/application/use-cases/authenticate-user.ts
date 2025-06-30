import { BaseResult, BaseUseCase } from '@application/use-cases/base-use-case';
import { Logger } from '@awslambdahackathon/types';
import { User } from '@domain/entities/user';
import { PerformanceMonitoringService } from '@domain/services/performance-monitoring-service';
import { AuthenticationService } from '@infrastructure/services/authentication-service';

export interface AuthenticateUserCommand {
  token: string;
}

export interface AuthenticateUserResult extends BaseResult {
  user?: User;
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
      this.logger.info('Starting user authentication', {
        hasToken: !!command.token,
        tokenLength: command.token ? command.token.length : 0,
        tokenPrefix: command.token
          ? command.token.substring(0, 20) + '...'
          : 'none',
      });

      if (!command.token) {
        this.logger.error('Authentication failed: No token provided');
        return {
          success: false,
          error: 'Token is required',
        };
      }

      this.logger.info('Calling authentication service');
      const authResult = await this.authService.authenticateUser({
        token: command.token,
      });

      this.logger.info('Authentication service response', {
        success: authResult.success,
        hasUser: !!authResult.user,
        error: authResult.error,
        userId: authResult.user?.getUserId(),
        username: authResult.user?.getUsername(),
      });

      if (authResult.success && authResult.user) {
        this.logger.info('User authentication successful', {
          userId: authResult.user.getUserId(),
          username: authResult.user.getUsername(),
          isActive: authResult.user.isActive(),
        });
      } else {
        this.logger.error('User authentication failed', {
          error: authResult.error,
          success: authResult.success,
        });
      }

      return authResult;
    } catch (error) {
      this.logger.error('Authentication use case failed with exception', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return this.handleError(error, {
        hasToken: !!command.token,
      });
    }
  }
}
