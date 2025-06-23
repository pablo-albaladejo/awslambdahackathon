import {
  withAuthenticator,
  WithAuthenticatorProps,
} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { logger } from '@awslambdahackathon/utils/frontend';
import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import DashboardPage from './DashboardPage';
import HomePage from './HomePage';
import Layout from './Layout';
import ProtectedRoute from './ProtectedRoute';
import { initializeRUM } from './rum-config';

function App({ user, signOut }: WithAuthenticatorProps) {
  // Initialize RUM when user is authenticated
  useEffect(() => {
    if (user) {
      initializeRUM().catch(error => {
        logger.error('Failed to initialize CloudWatch RUM', { error });
      });
    }
  }, [user]);

  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}

export default withAuthenticator(App);
