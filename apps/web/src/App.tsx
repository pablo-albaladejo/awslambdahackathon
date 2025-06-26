import {
  withAuthenticator,
  WithAuthenticatorProps,
} from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import React, {
  ErrorInfo,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
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

// Lazy load components with better error handling
const ChatbotPage = lazy(() =>
  import('./ChatbotPage').then(module => ({
    default: module.default,
  }))
);

const DashboardPage = lazy(() =>
  import('./DashboardPage').then(module => ({
    default: module.default,
  }))
);

// Memoized loading component
const LoadingSpinner = React.memo(() => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>
));

LoadingSpinner.displayName = 'LoadingSpinner';

function App({ signOut }: WithAuthenticatorProps) {
  const { groups, loading } = useCurrentUser();
  const { trackPageView, trackError, trackEvent } = useRumTracking();
  const location = useLocation();
  const errorListenersRef = useRef<{
    error: ((event: ErrorEvent) => void) | null;
    unhandledRejection: ((event: PromiseRejectionEvent) => void) | null;
  }>({ error: null, unhandledRejection: null });
  const clickListenerRef = useRef<((event: MouseEvent) => void) | null>(null);

  // Memoized user group
  const userGroup = useMemo((): 'Admins' | 'Users' | null => {
    if (Array.isArray(groups)) {
      if (groups.includes('Admins')) return 'Admins';
      if (groups.includes('Users')) return 'Users';
    }
    return null;
  }, [groups]);

  // Memoized sign out handler
  const handleSignOut = useCallback(async () => {
    if (signOut) {
      signOut();
    }
  }, [signOut]);

  // Memoized React error handler
  const handleReactError = useCallback(
    (error: Error, errorInfo: ErrorInfo) => {
      const enhancedError = new Error(error.message);
      enhancedError.stack = `${error.stack}\n\nComponent Stack:\n${errorInfo.componentStack}`;
      trackError(enhancedError, 'React Component Error');
    },
    [trackError]
  );

  // Memoized error event handlers
  const handleGlobalError = useCallback(
    (event: ErrorEvent) => {
      const error = new Error(event.message);
      error.stack = `${event.filename}:${event.lineno}:${event.colno}`;
      trackError(error, 'Global JavaScript Error');
    },
    [trackError]
  );

  const handleUnhandledRejection = useCallback(
    (event: PromiseRejectionEvent) => {
      const error =
        event.reason instanceof Error
          ? event.reason
          : new Error(String(event.reason));
      trackError(error, 'Unhandled Promise Rejection');
    },
    [trackError]
  );

  // Memoized click handler
  const handleClick = useCallback(
    (event: MouseEvent) => {
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
    },
    [trackEvent, location.pathname]
  );

  // Effect for page view tracking
  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname, trackPageView]);

  // Effect for global error listeners with proper cleanup
  useEffect(() => {
    // Store references for cleanup
    errorListenersRef.current.error = handleGlobalError;
    errorListenersRef.current.unhandledRejection = handleUnhandledRejection;

    // Add error listeners
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Cleanup function
    return () => {
      if (errorListenersRef.current.error) {
        window.removeEventListener('error', errorListenersRef.current.error);
      }
      if (errorListenersRef.current.unhandledRejection) {
        window.removeEventListener(
          'unhandledrejection',
          errorListenersRef.current.unhandledRejection
        );
      }
    };
  }, [handleGlobalError, handleUnhandledRejection]);

  // Effect for click tracking with proper cleanup
  useEffect(() => {
    // Store reference for cleanup
    clickListenerRef.current = handleClick;

    // Add click listener
    document.addEventListener('click', handleClick, true);

    // Cleanup function
    return () => {
      if (clickListenerRef.current) {
        document.removeEventListener('click', clickListenerRef.current, true);
      }
    };
  }, [handleClick]);

  // Memoized routes based on user group
  const routes = useMemo(() => {
    if (loading) {
      return <Route path="*" element={<LoadingSpinner />} />;
    }

    if (userGroup === 'Admins') {
      return (
        <>
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute requiredGroup="Admins">
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </>
      );
    }

    return (
      <>
        <Route path="/" element={<Navigate to="/chatbot" />} />
        <Route
          path="/chatbot"
          element={
            <ProtectedRoute requiredGroup="Users">
              <ChatbotPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/chatbot" />} />
      </>
    );
  }, [loading, userGroup]);

  return (
    <ErrorBoundary onError={handleReactError}>
      <AwsRumProvider>
        <Router>
          <WebSocketProvider>
            <Layout signOut={handleSignOut}>
              <Suspense fallback={<LoadingSpinner />}>
                <Routes>{routes}</Routes>
              </Suspense>
            </Layout>
          </WebSocketProvider>
        </Router>
      </AwsRumProvider>
    </ErrorBoundary>
  );
}

export default withAuthenticator(App);
