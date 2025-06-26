import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { configureAmplify } from './amplify-config';
import App from './App.tsx';
import { RumProvider } from './contexts/RumContext';
import './index.css';

// Initialize Amplify configuration
configureAmplify();

const AppTree = (
  <BrowserRouter>
    <App />
  </BrowserRouter>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RumProvider>{AppTree}</RumProvider>
  </React.StrictMode>
);
