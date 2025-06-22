import {
  withAuthenticator,
  WithAuthenticatorProps,
} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { fetchAuthSession } from 'aws-amplify/auth';
import { useEffect } from 'react';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';

import { configureAmplify } from './amplify-config';
import DashboardPage from './DashboardPage';
import HomePage from './HomePage';
import ProtectedRoute from './ProtectedRoute';

configureAmplify();

function App({ user }: WithAuthenticatorProps) {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect user based on their group after login
    const getUserGroups = async () => {
      try {
        const session = await fetchAuthSession();
        const groups =
          (session.tokens?.accessToken?.payload[
            'cognito:groups'
          ] as string[]) || [];

        if (groups.includes('Admins')) {
          navigate('/dashboard');
        } else if (groups.includes('Users')) {
          navigate('/');
        } else {
          // Default fallback for users without specific groups
          navigate('/');
        }
      } catch (error) {
        // Default to home page if we can't determine groups
        navigate('/');
      }
    };

    if (user) {
      getUserGroups();
    }
  }, [user, navigate]);

  return (
    <Routes>
      <Route
        path="/"
        element={
          <ProtectedRoute requiredGroup="Users">
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute requiredGroup="Admins">
            <DashboardPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

const AppWithRouter = () => (
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

export default withAuthenticator(AppWithRouter);
