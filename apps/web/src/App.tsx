import {
  withAuthenticator,
  WithAuthenticatorProps,
} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import {
  Component,
  ErrorInfo,
  lazy,
  ReactNode,
  Suspense,
  useCallback,
  useEffect,
} from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { useCurrentUser } from './hooks/useCurrentUser';
import { useRumTracking } from './hooks/useRumTracking';
import Layout from './Layout';
import ProtectedRoute from './ProtectedRoute';

// Error Boundary component for React errors
interface ErrorBoundaryProps {
  children: ReactNode;
  onError: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Something went wrong
            </h1>
            <p className="text-gray-600 mb-4">
              An unexpected error occurred. Please refresh the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

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
      <Layout signOut={handleSignOut}>
        <Suspense fallback={<div>Loading...</div>}>
          <Routes>
            <Route
              path="/"
              element={(() => {
                if (loading) {
                  return (
                    <div className="min-h-screen flex items-center justify-center text-lg">
                      Cargando...
                    </div>
                  );
                }
                const group = getUserGroup();
                if (group === 'Admins')
                  return <Navigate to="/dashboard" replace />;
                if (group === 'Users')
                  return <Navigate to="/chatbot" replace />;
                return (
                  <div className="min-h-screen flex items-center justify-center text-lg">
                    No autorizado
                  </div>
                );
              })()}
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
    </ErrorBoundary>
  );
}

export default withAuthenticator(App);
