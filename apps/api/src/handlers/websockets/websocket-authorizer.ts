import { logger } from '@awslambdahackathon/utils/backend';
import { CognitoJwtVerifier } from 'aws-jwt-verify';

interface AuthorizerEvent {
  type: string;
  methodArn: string;
  resource: string;
  headers: Record<string, string>;
  queryStringParameters: Record<string, string> | null;
  requestContext: {
    accountId: string;
    apiId: string;
    domainName: string;
    stage: string;
    requestId: string;
    identity: {
      sourceIp: string;
      userAgent: string;
    };
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
    logger.info('WebSocket authorizer called with event', {
      type: event.type,
      methodArn: event.methodArn,
      resource: event.resource,
      queryStringParameters: event.queryStringParameters,
      headers: event.headers,
    });

    // Extract the token from the query parameter
    const token = event.queryStringParameters?.Authorization;

    if (!token) {
      logger.warn('No authorization token provided in query parameters', {
        queryStringParameters: event.queryStringParameters,
      });
      throw new Error('Unauthorized');
    }

    logger.info('Authorization token found in query parameters', {
      tokenLength: token.length,
      tokenStart: token.substring(0, 10) + '...',
    });

    // Log environment variables
    logger.info('Environment variables', {
      userPoolId: process.env.COGNITO_USER_POOL_ID,
      clientId: process.env.COGNITO_CLIENT_ID,
    });

    // Verify the JWT token
    const verifier = CognitoJwtVerifier.create({
      userPoolId: process.env.COGNITO_USER_POOL_ID!,
      tokenUse: 'access',
      clientId: process.env.COGNITO_CLIENT_ID!,
    });

    let payload;
    try {
      payload = await verifier.verify(token);
      logger.info('WebSocket authorization successful', {
        userId: payload.sub,
        username: payload.username,
      });
    } catch (verifyError) {
      logger.error('Token verification failed', {
        error:
          verifyError instanceof Error
            ? verifyError.message
            : String(verifyError),
      });
      throw verifyError;
    }

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
      event,
    });
    throw new Error('Unauthorized');
  }
};

export const handler = websocketAuthorizerHandler;
