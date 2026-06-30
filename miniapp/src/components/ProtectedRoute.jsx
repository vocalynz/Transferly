import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { MiniAppState } from './MiniAppState';

export function ProtectedRoute({ children }) {
  const { user, loading } = useAppContext();

  if (loading) {
    return (
      <MiniAppState
        tone="loading"
        title="Checking access"
        description="Opening your Transferly workspace."
      />
    );
  }

  if (!user) {
    return <Navigate to="/miniapp" replace />;
  }

  return children;
}
