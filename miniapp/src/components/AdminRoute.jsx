import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { MiniAppState } from './MiniAppState';

export function AdminRoute({ children }) {
  const { user, profile, loading } = useAppContext();

  if (loading) {
    return (
      <MiniAppState
        tone="loading"
        title="Checking admin access"
        description="Preparing the operations console."
      />
    );
  }

  if (!user) return <Navigate to="/miniapp" replace />;
  if (!profile?.is_admin) return <Navigate to="/miniapp" replace />;

  return children;
}
