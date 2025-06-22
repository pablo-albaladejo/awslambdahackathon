import { capitalize } from '@awslambdahackathon/utils';
import { fetchAuthSession } from 'aws-amplify/auth';
import { useEffect, useState } from 'react';

import './App.css';
import { API_CONFIG, apiClient } from './config/api';

function HomePage() {
  const [count, setCount] = useState(0);
  const [apiStatus, setApiStatus] = useState('');
  const [authStatus, setAuthStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    testApiConnection();
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    setAuthLoading(true);
    try {
      const session = await fetchAuthSession();
      if (session.tokens?.idToken) {
        setAuthStatus('✅ Authenticated - Token available');
      } else {
        setAuthStatus('❌ Not authenticated - No token available');
      }
    } catch (error) {
      setAuthStatus(
        `❌ Auth error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const testApiConnection = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<{ message: string }>(
        API_CONFIG.endpoints.health
      );
      if (response.success) {
        setApiStatus(response.data?.message || 'API connected successfully!');
      } else {
        setApiStatus(`API error: ${response.error || 'Unknown error'}`);
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        setApiStatus(`Failed to connect to API: ${error.message}`);
      } else {
        setApiStatus('Failed to connect to API: Unknown error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>AWS Lambda Hackathon</h1>
        <p>Welcome to your Turborepo + Vite + React application!</p>
        <div className="card">
          <button onClick={() => setCount(c => c + 1)}>Count is {count}</button>
          <p>
            Edit <code>src/App.tsx</code> and save to test HMR
          </p>
        </div>
        <div className="utils-demo">
          <h3>Utils Package Demo</h3>
          <p>Capitalized "hello world": {capitalize('hello world')}</p>
        </div>
        <div className="auth-demo">
          <h3>Authentication Status</h3>
          <p>
            Status: {authLoading ? 'Checking...' : authStatus || 'Not checked'}
          </p>
          <button onClick={checkAuthStatus} disabled={authLoading}>
            {authLoading ? 'Checking...' : 'Check Auth Status'}
          </button>
        </div>
        <div className="api-demo">
          <h3>API Connection Demo (Protected Endpoint)</h3>
          <p>API URL: {API_CONFIG.baseUrl}</p>
          <p>Status: {loading ? 'Loading...' : apiStatus || 'Not tested'}</p>
          <button onClick={testApiConnection} disabled={loading}>
            {loading ? 'Testing...' : 'Test Protected API'}
          </button>
        </div>
        <div className="links">
          <a
            className="App-link"
            href="https://turbo.build/repo"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn Turborepo
          </a>
          <a
            className="App-link"
            href="https://vitejs.dev/guide/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn Vite
          </a>
        </div>
      </header>
    </div>
  );
}

export default HomePage;
