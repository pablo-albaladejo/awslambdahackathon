import {
  withAuthenticator,
  WithAuthenticatorProps,
} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';

import DashboardPage from './DashboardPage';
import HomePage from './HomePage';
import { useRumTracking } from './hooks/useRumTracking';
import Layout from './Layout';
import ProtectedRoute from './ProtectedRoute';

function App({ user, signOut }: WithAuthenticatorProps) {
  const { setAuthenticatedUser } = useRumTracking();

  useEffect(() => {
    // Set authenticated user in RUM when user is available
    if (user?.userId) {
      setAuthenticatedUser(user.userId);
    }
  }, [user?.userId, setAuthenticatedUser]);

  return (
    <Layout user={user} signOut={signOut}>
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
    </Layout>
  );
}

export default withAuthenticator(App);
