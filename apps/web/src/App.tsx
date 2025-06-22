import { capitalize } from '@awslambdahackathon/utils';
import { useEffect, useState } from 'react';
import './App.css';
import { API_CONFIG, apiClient } from './config/api';

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
}

function App() {
  const [count, setCount] = useState(0);
  const [apiMessage, setApiMessage] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Test API connection on component mount
    testApiConnection();
  }, []);

  const testApiConnection = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get<ApiResponse>(
        API_CONFIG.endpoints.hello
      );
      if (response.success) {
        setApiMessage(response.data?.message || 'API connected successfully!');
      } else {
        setApiMessage('API error: ' + (response.error || 'Unknown error'));
      }
    } catch (error) {
      setApiMessage('Failed to connect to API: ' + (error as Error).message);
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
          <button onClick={() => setCount(count => count + 1)}>
            Count is {count}
          </button>
          <p>
            Edit <code>src/App.tsx</code> and save to test HMR
          </p>
        </div>

        <div className="utils-demo">
          <h3>Utils Package Demo</h3>
          <p>Capitalized "hello world": {capitalize('hello world')}</p>
        </div>

        <div className="api-demo">
          <h3>API Connection Demo</h3>
          <p>API URL: {API_CONFIG.baseUrl}</p>
          <p>Status: {loading ? 'Loading...' : apiMessage || 'Not tested'}</p>
          <button onClick={testApiConnection} disabled={loading}>
            {loading ? 'Testing...' : 'Test API Connection'}
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

export default App;
