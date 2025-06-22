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

export const handler = async (event: any): Promise<any> => {
  console.log('Event:', JSON.stringify(event, null, 2));

  const { UserPoolId, Users, TemporaryPasswordSecretArn } =
    event.ResourceProperties;

  if (event.RequestType === 'Delete') {
    // In a real-world scenario, you might want to handle user deletion.
    // For this case, we'll do nothing on stack deletion to avoid accidental data loss.
    console.log('Delete request received. No action taken.');
    return {
      PhysicalResourceId: event.PhysicalResourceId,
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
        console.log(`Successfully created user: ${username}`);
      } catch (error: any) {
        if (error.name === 'UsernameExistsException') {
          console.log(`User ${username} already exists. Skipping creation.`);
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
      console.log(`Successfully added user ${username} to group ${group}`);
    }

    return {
      PhysicalResourceId: `cognito-default-users-${Date.now()}`,
    };
  } catch (error: any) {
    console.error('Error creating default users:', error);
    throw new Error('Failed to create default Cognito users.');
  }
};
