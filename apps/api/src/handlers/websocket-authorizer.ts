import { logger } from '@awslambdahackathon/utils/backend';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

interface AuthorizerEvent {
  type: string;
  methodArn: string;
  authorizationToken: string;
  resource: string;
  path: string;
  httpMethod: string;
  headers: Record<string, string>;
  queryStringParameters: Record<string, string> | null;
  pathParameters: Record<string, string> | null;
  stageVariables: Record<string, string> | null;
  requestContext: {
    path: string;
    accountId: string;
    resourceId: string;
    stage: string;
    requestId: string;
    identity: {
      sourceIp: string;
      userAgent: string;
    };
    resourcePath: string;
    httpMethod: string;
    apiId: string;
  };
}

interface AuthorizerResponse {
  principalId: string;
  policyDocument: {
    Version: string;
    Statement: Array<{
      Action: string;
      Effect: string;
      Resource: string;
    }>;
  };
  context?: Record<string, string>;
}

const websocketAuthorizerHandler = async (
  event: AuthorizerEvent
): Promise<AuthorizerResponse> => {
  try {
    logger.info('WebSocket authorizer called', {
      type: event.type,
      methodArn: event.methodArn,
      resource: event.resource,
    });

    // Extract the token from the Authorization header or query parameter
    const token =
      event.authorizationToken || event.queryStringParameters?.token;

    if (!token) {
      logger.warn('No authorization token provided');
      throw new Error('Unauthorized');
    }

    // Remove 'Bearer ' prefix if present
    const cleanToken = token.startsWith('Bearer ') ? token.substring(7) : token;

    // Verify the JWT token
    const verifier = CognitoJwtVerifier.create({
      userPoolId: process.env.COGNITO_USER_POOL_ID!,
      tokenUse: 'access',
      clientId: process.env.COGNITO_CLIENT_ID!,
    });

    const payload = await verifier.verify(cleanToken);

    logger.info('WebSocket authorization successful', {
      userId: payload.sub,
      username: payload.username,
    });

    // Generate policy document
    const policyDocument = {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: 'Allow',
          Resource: event.methodArn,
        },
      ],
    };

    // Return the policy document with user context
    return {
      principalId: payload.sub,
      policyDocument,
      context: {
        userId: payload.sub,
        username: (payload.username as string) || payload.sub,
        email: (payload.email as string) || '',
      },
    };
  } catch (error) {
    logger.error('WebSocket authorization failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw new Error('Unauthorized');
  }
};

export const handler = websocketAuthorizerHandler;
