import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { configureAmplify } from './amplify-config';
import App from './App.tsx';
import { AwsRumProvider } from './contexts/RumContext';
import './index.css';

// Initialize Amplify configuration
configureAmplify();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AwsRumProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AwsRumProvider>
  </React.StrictMode>
);
