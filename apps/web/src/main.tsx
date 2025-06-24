import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { configureAmplify } from './amplify-config';
import App from './App.tsx';
import { AwsRumProvider } from './contexts/RumContext';
import './index.css';

// Initialize Amplify configuration
configureAmplify();

const isLocal =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';

const AppTree = (
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isLocal ? AppTree : <AwsRumProvider>{AppTree}</AwsRumProvider>}
  </React.StrictMode>
);
