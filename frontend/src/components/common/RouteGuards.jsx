import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import LoadingScreen from './LoadingScreen.jsx';

// Guards routes that require active session
export function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/landing" replace />;
}

// Guards routes that must not be accessed when logged in (like Login or Register)
export function AuthRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return isAuthenticated ? <Navigate to="/chat" replace /> : <Outlet />;
}

