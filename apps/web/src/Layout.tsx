import React from 'react';

import { useCurrentUser } from './hooks/useCurrentUser';

const Layout = ({
  children,
  signOut,
}: {
  children: React.ReactNode;
  signOut?: () => void;
}) => {
  const { email, groups, loading } = useCurrentUser();
  const appName = import.meta.env.VITE_APP_NAME || 'MyApp';

  const handleLogout = () => {
    if (signOut) {
      signOut();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-lg">
        Cargando...
      </div>
    );
  }

  return (
    <div className="layout-bg">
      <nav className="layout-navbar">
        <div className="layout-navbar-content">
          <span className="layout-appname">{appName}</span>
          <div className="layout-userinfo">
            <span className="layout-email">
              Welcome, <strong>{email}</strong>
            </span>
            {groups.length > 0 && (
              <span className="layout-groups">{groups.join(', ')}</span>
            )}
            <button onClick={handleLogout} className="layout-logout-btn">
              Logout
            </button>
          </div>
        </div>
      </nav>
      <main className="layout-main">
        <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
