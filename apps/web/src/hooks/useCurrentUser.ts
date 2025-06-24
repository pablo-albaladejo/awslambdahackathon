import { fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth';
import { useEffect, useState } from 'react';

export interface CurrentUser {
  email?: string;
  groups: string[];
  attributes: Record<string, any>;
  session: any;
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
        const session = await fetchAuthSession();
        const attributes = await fetchUserAttributes();
        const groups =
          session.tokens?.accessToken?.payload?.['cognito:groups'] || [];
        const email = attributes.email || attributes.username || '';
        if (isMounted) {
          setUser({
            email,
            groups: Array.isArray(groups) ? groups : [],
            attributes,
            session,
          });
          setError(null);
        }
      } catch (err) {
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
