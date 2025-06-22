import { logger } from '@awslambdahackathon/utils/frontend';
import React from 'react';
import ReactDOM from 'react-dom/client';

import { configureAmplify } from './amplify-config';
import App from './App.tsx';
import './index.css';
import { initializeRUM } from './rum-config';

// Initialize Amplify configuration
configureAmplify();

// Initialize CloudWatch RUM for monitoring
initializeRUM().catch(error => {
  logger.error('Failed to initialize CloudWatch RUM', { error });
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
