import {
  withAuthenticator,
  WithAuthenticatorProps,
} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
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
    const groups =
      user?.getSignInUserSession()?.getAccessToken().getJwtToken()[
        'cognito:groups'
      ] || [];
    if (groups.includes('Admins')) {
      navigate('/dashboard');
    } else if (groups.includes('Users')) {
      navigate('/');
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
