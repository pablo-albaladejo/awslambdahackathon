import { logger } from '@awslambdahackathon/utils/lambda';
import { AUTH_CONFIG } from '@config/constants';
import { container } from '@config/container';
import { AuthenticationError } from '@domain/errors';
import {
  TokenVerificationService as DomainTokenVerificationService,
  JwtPayload,
  TokenVerificationResult,
} from '@domain/services/token-verification-service';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

export class TokenVerificationService
  implements DomainTokenVerificationService
{
  private readonly verifier: ReturnType<typeof CognitoJwtVerifier.create>;

  constructor() {
    logger.info('Initializing TokenVerificationService');

    const userPoolId = process.env.COGNITO_USER_POOL_ID;
    const clientId = process.env.COGNITO_CLIENT_ID;

    if (!userPoolId) {
      throw new Error('COGNITO_USER_POOL_ID environment variable is required');
    }
    if (!clientId) {
      throw new Error('COGNITO_CLIENT_ID environment variable is required');
    }

    this.verifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: AUTH_CONFIG.TOKEN_USE,
      clientId,
    });
  }

  async verifyToken(token: string): Promise<TokenVerificationResult> {
    return container
      .getCircuitBreakerService()
      .execute('token-verification', 'verifyToken', async () => {
        try {
          if (!this.validateTokenFormat(token)) {
            return {
              success: false,
              error: 'Invalid token format',
            };
          }

          const payload = await this.verifier.verify(token);

          return {
            success: true,
            payload: payload as JwtPayload,
          };
        } catch (error) {
          logger.error('Token verification failed', {
            error: error instanceof Error ? error.message : String(error),
          });

          return {
            success: false,
            error: 'Token verification failed',
          };
        }
      });
  }

  async extractUserId(token: string): Promise<string> {
    const result = await this.verifyToken(token);

    if (!result.success || !result.payload) {
      throw new AuthenticationError('Failed to extract user ID from token');
    }

    return result.payload.sub;
  }

  validateTokenFormat(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }

    // Basic JWT format validation (header.payload.signature)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    // Check if parts are base64 encoded
    try {
      parts.forEach(part => {
        if (part) {
          atob(part.replace(/-/g, '+').replace(/_/g, '/'));
        }
      });
      return true;
    } catch {
      return false;
    }
  }
}
