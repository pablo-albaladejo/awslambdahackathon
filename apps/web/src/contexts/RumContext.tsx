import { logger } from '@awslambdahackathon/utils/frontend';
import { fetchAuthSession } from 'aws-amplify/auth';
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

// Environment variables
const applicationId = import.meta.env.VITE_RUM_APP_MONITOR_ID || '';
const identityPoolId = import.meta.env.VITE_RUM_IDENTITY_POOL_ID || '';
const region = import.meta.env.VITE_AWS_REGION || 'us-east-2';
const endpoint = `https://dataplane.rum.${region}.amazonaws.com`;
const version = '1.0.0';

// Define a simplified RUM interface
interface RumInstance {
  recordPageView: () => void;
  recordError: (error: Error) => void;
  recordEvent: (eventName: string, data: unknown) => void;
  setAuthenticatedUser?: (userId: string) => void;
}

// Define the context type
export type AwsRumContextType = {
  rum: RumInstance | null;
  isInitialized: boolean;
  error: string | null;
};

// Create the context
const AwsRumContext = createContext<AwsRumContextType>({
  rum: null,
  isInitialized: false,
  error: null,
});

interface AwsRumProviderProps {
  children: ReactNode;
}

export const AwsRumProvider: React.FC<AwsRumProviderProps> = ({ children }) => {
  const [rum, setRum] = useState<RumInstance | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeRUM = async () => {
      // Skip in server environment
      if (typeof window === 'undefined') {
        logger.info('Skipping RUM initialization in server environment');
        setIsInitialized(true);
        return;
      }

      try {
        // Validate required environment variables
        if (!applicationId || !identityPoolId || !region) {
          const errorMsg =
            'RUM configuration is missing required environment variables';
          logger.warn(errorMsg);
          setError(errorMsg);
          setIsInitialized(true);
          return;
        }

        logger.info('Initializing RUM with config:', {
          applicationId,
          identityPoolId,
          region,
        });

        // RUM configuration
        const config = {
          sessionSampleRate: 1,
          identityPoolId,
          endpoint,
          telemetries: ['performance', 'errors', 'http'],
          allowCookies: true,
          enableXRay: true,
        };

        // Dynamic import to avoid type issues
        const { AwsRum } = await import('aws-rum-web');
        const rumInstance = new AwsRum(applicationId, version, region, config);

        // Cast to our interface
        const typedRumInstance: RumInstance = rumInstance as any;
        setRum(typedRumInstance);

        // Make it globally available (for compatibility)
        (window as any).awsRum = rumInstance;

        logger.info('CloudWatch RUM initialized successfully');

        // Try to associate with authenticated user if available
        try {
          const session = await fetchAuthSession();
          const idToken = session.tokens?.idToken;

          if (idToken?.payload.sub && typedRumInstance.setAuthenticatedUser) {
            typedRumInstance.setAuthenticatedUser(
              idToken.payload.sub.toString()
            );
            logger.info('RUM session associated with authenticated user');
          }
        } catch (authError) {
          logger.info('Continuing RUM session as anonymous user');
        }
      } catch (initError) {
        const errorMsg = `Failed to initialize CloudWatch RUM: ${initError}`;
        logger.warn(errorMsg);
        setError(errorMsg);

        // Set rum to null on error
        setRum(null);
      } finally {
        setIsInitialized(true);
      }
    };

    initializeRUM();
  }, []);

  const contextValue: AwsRumContextType = {
    rum,
    isInitialized,
    error,
  };

  return (
    <AwsRumContext.Provider value={contextValue}>
      {children}
    </AwsRumContext.Provider>
  );
};

// Hook to access the AwsRum context
export const useAwsRum = (): AwsRumContextType => {
  const context = useContext(AwsRumContext);
  if (context === undefined) {
    throw new Error('useAwsRum must be used within an AwsRumProvider');
  }
  return context;
};
