import { fetchAuthSession } from 'aws-amplify/auth';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactElement;
  requiredGroup: 'Admins' | 'Users';
}

const ProtectedRoute = ({ children, requiredGroup }: ProtectedRouteProps) => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const session = await fetchAuthSession();
        const userGroups =
          (session.tokens?.accessToken.payload['cognito:groups'] as string[]) ||
          [];

        if (session.tokens && userGroups.includes(requiredGroup)) {
          setIsAuthenticated(true);
        } else {
          // User is authenticated but not in the required group,
          // or is not authenticated at all.
          // You might want to navigate to a specific "unauthorized" page
          // or just back to the home/login page.
          navigate('/');
        }
      } catch (error) {
        // Not authenticated
        navigate('/');
      }
    };

    checkAuth();
  }, [navigate, requiredGroup]);

  return isAuthenticated ? children : null; // Or a loading spinner
};

export default ProtectedRoute;
