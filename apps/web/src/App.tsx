import {
  withAuthenticator,
  WithAuthenticatorProps,
} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { configureAmplify } from './amplify-config';
import DashboardPage from './DashboardPage';
import HomePage from './HomePage';
import Layout from './Layout';
import ProtectedRoute from './ProtectedRoute';

configureAmplify();

function App({ user, signOut }: WithAuthenticatorProps) {
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

const AppWithRouter = () => (
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

export default withAuthenticator(AppWithRouter);
