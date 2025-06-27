import { logger } from '@awslambdahackathon/utils/frontend';
import {
  AuthSession,
  fetchAuthSession,
  fetchUserAttributes,
  FetchUserAttributesOutput,
  getCurrentUser,
} from 'aws-amplify/auth';
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

export interface CurrentUser {
  email?: string;
  groups: string[];
  attributes: FetchUserAttributesOutput['attributes'];
  session: AuthSession;
}

interface UserContextValue {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  groups: string[];
  email: string;
  loading: boolean;
  error: Error | null;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const currentUser = await getCurrentUser();
        logger.info('Current user fetched', {
          username: currentUser.username,
          userId: currentUser.userId,
        });
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

  const value: UserContextValue = {
    user,
    isAuthenticated: !!user,
    groups: user?.groups || [],
    email: user?.email || '',
    loading,
    error,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUserContext = () => {
  const context = useContext(UserContext);
  if (!context)
    throw new Error('useUserContext must be used within a UserProvider');
  return context;
};
