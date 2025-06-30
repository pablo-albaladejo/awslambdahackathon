export interface JwtPayload {
  sub: string;
  email?: string;
  username?: string;
  groups?: string[];
  [key: string]: unknown;
}

export interface TokenVerificationResult {
  success: boolean;
  payload?: JwtPayload;
  error?: string;
}

export interface TokenVerificationService {
  verifyToken(token: string): Promise<TokenVerificationResult>;
  extractUserId(token: string): Promise<string>;
  validateTokenFormat(token: string): boolean;
}
