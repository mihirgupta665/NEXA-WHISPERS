import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

// Guards routes that require active session
export function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-heading)',
        fontSize: '18px'
      }}>
        <span>Loading Nexa Whispers...</span>
      </div>
    );
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/landing" replace />;
}

// Guards routes that must not be accessed when logged in (like Login or Register)
export function AuthRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        height: '100vh',
        width: '100vw',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-heading)',
        fontSize: '18px'
      }}>
        <span>Loading Nexa Whispers...</span>
      </div>
    );
  }

  return isAuthenticated ? <Navigate to="/chat" replace /> : <Outlet />;
}
