import { logger } from '@awslambdahackathon/utils/frontend';
import { fetchAuthSession } from 'aws-amplify/auth';
import { AwsRum } from 'aws-rum-web';
import { PartialConfig } from 'aws-rum-web/dist/cjs/orchestration/Orchestration';
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

const cwrConfig: PartialConfig = {
  allowCookies: true,
  endpoint: `https://dataplane.rum.${import.meta.env.VITE_AWS_REGION}.amazonaws.com`,
  identityPoolId: import.meta.env.VITE_RUM_IDENTITY_POOL_ID,
  telemetries: ['errors', 'performance', 'http'],
};

const cwrAppMonitorDetails = {
  id: import.meta.env.VITE_RUM_APP_MONITOR_ID,
  version: '1.0.0',
  region: import.meta.env.VITE_AWS_REGION,
};

export interface RumInstance {
  recordPageView: (pageId: string) => void;
  recordError: (error: Error) => void;
  recordEvent: (eventName: string, data: unknown) => void;
  setAuthenticatedUser: (userId: string | undefined) => void;
}

export type AwsRumContextType = {
  rum: RumInstance | null;
  isInitialized: boolean;
  error: string | null;
};

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
      if (typeof window === 'undefined' || isInitialized) {
        return;
      }

      try {
        const rumInstance = new AwsRum(
          cwrAppMonitorDetails.id,
          cwrAppMonitorDetails.version,
          cwrAppMonitorDetails.region,
          cwrConfig
        ) as unknown as RumInstance;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).awsRum = rumInstance;

        setRum(rumInstance);
        logger.info('RUM instance created.');

        try {
          const { tokens } = await fetchAuthSession();
          if (tokens) {
            const userId = tokens.idToken?.payload.sub?.toString();
            rumInstance.setAuthenticatedUser(userId);
            logger.info('RUM session tagged for authenticated user:', userId);
          } else {
            logger.info('RUM session is for a guest user.');
          }
        } catch (authError) {
          logger.info('RUM session is for a guest user (no session found).');
        }
      } catch (initError) {
        const errorMsg = `Failed to initialize CloudWatch RUM: ${initError}`;
        logger.error(errorMsg, initError);
        setError(errorMsg);
        setRum(null);
      } finally {
        setIsInitialized(true);
      }
    };

    initializeRUM();
  }, [isInitialized]);

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

export const useAwsRum = (): AwsRumContextType => {
  const context = useContext(AwsRumContext);
  if (context === undefined) {
    throw new Error('useAwsRum must be used within an AwsRumProvider');
  }
  return context;
};
