import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App.tsx';
import './index.css';
import { initializeRUM } from './rum-config';

// Initialize CloudWatch RUM for monitoring
// eslint-disable-next-line no-console
initializeRUM().catch(console.error);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
