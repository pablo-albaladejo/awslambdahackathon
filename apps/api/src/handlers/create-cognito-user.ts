import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  CognitoIdentityProviderClient,
} from '@aws-sdk/client-cognito-identity-provider';
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

const cognito = new CognitoIdentityProviderClient({});
const secretsManager = new SecretsManagerClient({});

interface CreateCognitoUserEvent {
  RequestType: string;
  ResourceProperties: {
    UserPoolId: string;
    Users: Array<{ username: string; group: string; email: string }>;
    TemporaryPasswordSecretArn: string;
  };
  PhysicalResourceId?: string;
}

interface CustomResourceResponse {
  PhysicalResourceId: string;
}

export const handler = async (
  event: CreateCognitoUserEvent
): Promise<CustomResourceResponse> => {
  // LOG: Received event (use a logger in production)
  // console.log('Event:', JSON.stringify(event, null, 2));

  const { UserPoolId, Users, TemporaryPasswordSecretArn } =
    event.ResourceProperties;

  if (event.RequestType === 'Delete') {
    // LOG: Delete request received. No action taken.
    return {
      PhysicalResourceId: event.PhysicalResourceId || 'cognito-default-users',
    };
  }

  try {
    const getSecretValueCommand = new GetSecretValueCommand({
      SecretId: TemporaryPasswordSecretArn,
    });
    const secretValue = await secretsManager.send(getSecretValueCommand);
    const temporaryPassword = secretValue.SecretString;

    if (!temporaryPassword) {
      throw new Error('Temporary password not found in Secrets Manager.');
    }

    for (const user of Users) {
      const { username, group, email } = user;

      // 1. Create the user
      try {
        await cognito.send(
          new AdminCreateUserCommand({
            UserPoolId,
            Username: username,
            TemporaryPassword: temporaryPassword,
            UserAttributes: [
              { Name: 'email', Value: email },
              { Name: 'email_verified', Value: 'true' },
            ],
            MessageAction: 'SUPPRESS', // Do not send welcome email
          })
        );
        // LOG: Successfully created user: username
      } catch (error) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'name' in error &&
          (error as { name: string }).name === 'UsernameExistsException'
        ) {
          // LOG: User already exists. Skipping creation.
        } else {
          throw error;
        }
      }

      // 2. Add user to the specified group
      await cognito.send(
        new AdminAddUserToGroupCommand({
          UserPoolId,
          Username: username,
          GroupName: group,
        })
      );
      // LOG: Successfully added user to group
    }

    return {
      PhysicalResourceId: `cognito-default-users-${Date.now()}`,
    };
  } catch (error) {
    // LOG: Error creating default users
    throw new Error('Failed to create default Cognito users.');
  }
};
