import { WithAuthenticatorProps } from '@aws-amplify/ui-react';
import { logger } from '@awslambdahackathon/utils/frontend';
import { fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth';
import { ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface LayoutProps extends WithAuthenticatorProps {
  children: ReactNode;
}

const Layout = ({ user, signOut, children }: LayoutProps) => {
  const navigate = useNavigate();
  const [userGroups, setUserGroups] = useState<string[]>([]);
  const [displayName, setDisplayName] = useState<string>('');
  const appName = import.meta.env.VITE_APP_NAME || 'MyApp';

  // Debug logs
  useEffect(() => {
    logger.info('Layout rendered', {
      hasUser: !!user,
      username: user?.username,
      hasSignOut: !!signOut,
    });
  }, [user, signOut]);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return; // Guard clause to satisfy linter

      try {
        const [session, attributes] = await Promise.all([
          fetchAuthSession(),
          fetchUserAttributes(),
        ]);

        const groups =
          (session.tokens?.accessToken.payload['cognito:groups'] as
            | string[]
            | undefined) || [];
        setUserGroups(groups);
        setDisplayName(attributes.email || user.username);

        logger.info('User data fetched', {
          groups,
          email: attributes.email,
        });
      } catch (error) {
        logger.error('Error fetching user data', { error });
      }
    };

    if (user) {
      fetchUserData();
    }
  }, [user]);

  const handleLogout = () => {
    if (signOut) {
      signOut();
    }
    navigate('/');
  };

  if (!user) {
    // If there is no user, we are in the login view, so we don't show the layout.
    // The children (routes) will be handled by the authenticator.
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white/30 backdrop-blur-md shadow-sm fixed top-0 left-0 right-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="font-bold text-xl text-white">{appName}</span>
            </div>
            <div className="flex items-center">
              <div className="flex items-center space-x-4">
                <span className="text-white">
                  Welcome, <strong>{displayName}</strong>
                </span>
                {userGroups.length > 0 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {userGroups.join(', ')}
                  </span>
                )}
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>
      <main className="pt-16">
        <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
