import { logger } from '@awslambdahackathon/utils/frontend';
import {
  AuthSession,
  fetchAuthSession,
  fetchUserAttributes,
  FetchUserAttributesOutput,
  getCurrentUser,
} from 'aws-amplify/auth';
import { useEffect, useState } from 'react';

export interface CurrentUser {
  email?: string;
  groups: string[];
  attributes: FetchUserAttributesOutput['attributes'];
  session: AuthSession;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        // First check if we have a current user
        const currentUser = await getCurrentUser();
        logger.info('Current user fetched', {
          username: currentUser.username,
          userId: currentUser.userId,
        });

        // Then get the session
        const session = await fetchAuthSession();
        logger.info('Auth session fetched in useCurrentUser', {
          hasIdToken: !!session.tokens?.idToken,
          hasAccessToken: !!session.tokens?.accessToken,
          accessTokenPayload: session.tokens?.accessToken?.payload,
        });

        const attributes = await fetchUserAttributes();
        const groups =
          session.tokens?.accessToken?.payload?.['cognito:groups'] || [];
        const email = attributes.email || currentUser.username || '';

        if (isMounted) {
          setUser({
            email,
            groups: Array.isArray(groups) ? groups.map(String) : [],
            attributes: attributes.attributes,
            session,
          });
          setError(null);
        }
      } catch (err) {
        logger.error('Error fetching user data', { error: err });
        if (isMounted) {
          setUser(null);
          setError(err as Error);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchData();
    return () => {
      isMounted = false;
    };
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    groups: user?.groups || [],
    email: user?.email || '',
    loading,
    error,
  };
}
