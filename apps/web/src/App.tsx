import {
  withAuthenticator,
  WithAuthenticatorProps,
} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { ErrorInfo, lazy, Suspense, useCallback, useEffect } from 'react';
import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
  useLocation,
} from 'react-router-dom';

import { configureAmplify } from './amplify-config';
import './App.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AwsRumProvider } from './contexts/RumContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { useCurrentUser } from './hooks/useCurrentUser';
import { useRumTracking } from './hooks/useRumTracking';
import Layout from './Layout';
import ProtectedRoute from './ProtectedRoute';

configureAmplify();

function App({ signOut }: WithAuthenticatorProps) {
  const { groups, loading } = useCurrentUser();
  const { trackPageView, trackError, trackEvent } = useRumTracking();
  const location = useLocation();

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname, trackPageView]);

  const handleSignOut = useCallback(async () => {
    if (signOut) {
      signOut();
    }
  }, [signOut]);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const error = new Error(event.message);
      error.stack = `${event.filename}:${event.lineno}:${event.colno}`;
      trackError(error, 'Global JavaScript Error');
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const error =
        event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason));
      trackError(error, 'Unhandled Promise Rejection');
    };

    // Add error listeners
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Cleanup listeners on unmount
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener(
        'unhandledrejection',
        handleUnhandledRejection
      );
    };
  }, [trackError]);

  // Track clicks automatically
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target) return;

      // Get the closest interactive element
      const interactiveElement = target.closest(
        'button, a, [role="button"], input[type="submit"], input[type="button"], [data-track]'
      );

      if (interactiveElement) {
        const element = interactiveElement as HTMLElement;

        // Extract useful information
        const elementType = element.tagName.toLowerCase();
        const elementText = element.textContent?.trim() || '';
        const elementId = element.id || '';
        const elementClass = element.className || '';
        const elementRole = element.getAttribute('role') || '';
        const elementDataTrack = element.getAttribute('data-track') || '';
        const elementHref = (element as HTMLAnchorElement).href || '';

        // Create event data
        const eventData = {
          elementType,
          text: elementText,
          id: elementId,
          className: elementClass,
          role: elementRole,
          href: elementHref,
          pathname: location.pathname,
          ...(elementDataTrack && { trackingId: elementDataTrack }),
        };

        // Create event name based on element
        let eventName = 'click';
        if (elementType === 'a') {
          eventName = elementHref.startsWith('http')
            ? 'external_link_click'
            : 'internal_link_click';
        } else if (elementType === 'button' || elementRole === 'button') {
          eventName = 'button_click';
        } else if (elementType === 'input') {
          eventName = 'form_button_click';
        }

        // Track the event
        trackEvent(eventName, eventData);
      }
    };

    // Add click listener
    document.addEventListener('click', handleClick, true);

    // Cleanup listener on unmount
    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, [trackEvent, location.pathname]);

  // Handle React component errors
  const handleReactError = (error: Error, errorInfo: ErrorInfo) => {
    const enhancedError = new Error(error.message);
    enhancedError.stack = `${error.stack}\n\nComponent Stack:\n${errorInfo.componentStack}`;
    trackError(enhancedError, 'React Component Error');
  };

  // Replace static imports with lazy imports for main pages
  const ChatbotPage = lazy(() => import('./ChatbotPage'));
  const DashboardPage = lazy(() => import('./DashboardPage'));

  function getUserGroup(): 'Admins' | 'Users' | null {
    if (Array.isArray(groups)) {
      if (groups.includes('Admins')) return 'Admins';
      if (groups.includes('Users')) return 'Users';
    }
    return null;
  }

  return (
    <ErrorBoundary onError={handleReactError}>
      <AwsRumProvider>
        <Router>
          <WebSocketProvider>
            <Layout signOut={handleSignOut}>
              <Suspense fallback={<div>Loading...</div>}>
                <Routes>
                  <Route
                    path="/"
                    element={
                      loading ? (
                        <div>Loading...</div>
                      ) : getUserGroup() === 'Admins' ? (
                        <Navigate to="/dashboard" />
                      ) : (
                        <Navigate to="/chatbot" />
                      )
                    }
                  />
                  <Route
                    path="/dashboard"
                    element={
                      <ProtectedRoute requiredGroup="Admins">
                        <DashboardPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/chatbot"
                    element={
                      <ProtectedRoute requiredGroup="Users">
                        <ChatbotPage />
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </Suspense>
            </Layout>
          </WebSocketProvider>
        </Router>
      </AwsRumProvider>
    </ErrorBoundary>
  );
}

export default withAuthenticator(App);
