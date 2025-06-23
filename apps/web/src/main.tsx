import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { configureAmplify } from './amplify-config';
import App from './App.tsx';
import { AuthProvider } from './contexts/AuthContext';
import { AwsRumProvider } from './contexts/RumContext';
import './index.css';

// Initialize Amplify configuration
configureAmplify();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AwsRumProvider>
      <AuthProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AuthProvider>
    </AwsRumProvider>
  </React.StrictMode>
);
