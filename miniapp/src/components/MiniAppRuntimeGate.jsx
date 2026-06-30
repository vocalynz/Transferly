import React from 'react';
import { useLocation } from 'react-router-dom';
import { useMiniAppRuntime } from '../context/MiniAppRuntimeContext';
import { MiniAppState } from './MiniAppState';

const blockingStatuses = new Set(['offline', 'error', 'auth-failed']);

export function MiniAppRuntimeGate({ children }) {
  const location = useLocation();
  const runtime = useMiniAppRuntime();
  const protectedWorkspace = location.pathname === '/admin' || location.pathname.startsWith('/miniapp');

  if (!protectedWorkspace) {
    return children;
  }

  if (runtime.status === 'loading' && runtime.authState === 'authenticating') {
    return (
      <MiniAppState
        tone="loading"
        title={runtime.label}
        description={runtime.detail}
      />
    );
  }

  if (blockingStatuses.has(runtime.status)) {
    return (
      <MiniAppState
        tone="error"
        title={runtime.label}
        description={runtime.detail}
        actionLabel="Retry"
        onAction={runtime.retry}
      />
    );
  }

  return children;
}
