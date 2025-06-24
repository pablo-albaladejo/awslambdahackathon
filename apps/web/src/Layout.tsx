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
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white/30 backdrop-blur-md shadow-sm fixed top-0 left-0 right-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <span className="font-bold text-xl text-white">{appName}</span>
            </div>
            <div className="flex items-center">
              <div className="flex items-center space-x-4">
                <span className="text-white">
                  Welcome, <strong>{email}</strong>
                </span>
                {groups.length > 0 && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {groups.join(', ')}
                  </span>
                )}
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>
      <main className="pt-16">
        <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
