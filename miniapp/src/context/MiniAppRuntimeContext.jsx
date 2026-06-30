import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAppContext } from './AppContext';
import { useTelegramMiniApp } from './TelegramMiniAppContext';

const MiniAppRuntimeContext = createContext(null);

function readOnlineState() {
  if (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean') {
    return true;
  }

  return navigator.onLine;
}

function describeRuntimeStatus({ online, loading, initializationError, telegramAuthState, telegramAvailable }) {
  if (!online) {
    return {
      status: 'offline',
      label: 'Connection unavailable',
      detail: 'Reconnect to the internet, then retry the Transferly workspace.'
    };
  }

  if (loading) {
    return {
      status: 'loading',
      label: 'Preparing Transferly',
      detail: telegramAvailable
        ? 'Securing the Telegram session and loading workspace data.'
        : 'Loading browser preview data and workspace state.'
    };
  }

  if (initializationError) {
    return {
      status: 'error',
      label: 'Workspace needs a retry',
      detail: initializationError.message || 'Transferly could not finish loading the mini app session.'
    };
  }

  if (telegramAuthState === 'failed') {
    return {
      status: 'auth-failed',
      label: 'Telegram session needs a retry',
      detail: 'Transferly could not verify the Telegram launch session.'
    };
  }

  return {
    status: 'ready',
    label: telegramAvailable ? 'Telegram session secured' : 'Browser preview mode',
    detail: telegramAvailable
      ? 'Native Telegram controls and Transferly workspace data are ready.'
      : 'Telegram runtime is unavailable, so native controls are shown in preview mode.'
  };
}

export function MiniAppRuntimeProvider({ children }) {
  const {
    initializationError,
    lastSyncedAt,
    loading,
    retryInitialization,
    telegramAuthState
  } = useAppContext();
  const telegram = useTelegramMiniApp();
  const { refresh: refreshTelegramRuntime } = telegram;
  const [online, setOnline] = useState(readOnlineState);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const updateOnlineState = () => setOnline(readOnlineState());
    window.addEventListener('online', updateOnlineState);
    window.addEventListener('offline', updateOnlineState);

    return () => {
      window.removeEventListener('online', updateOnlineState);
      window.removeEventListener('offline', updateOnlineState);
    };
  }, []);

  const retry = useCallback(async () => {
    refreshTelegramRuntime?.();
    return retryInitialization?.();
  }, [refreshTelegramRuntime, retryInitialization]);

  const value = useMemo(() => {
    const status = describeRuntimeStatus({
      online,
      loading,
      initializationError,
      telegramAuthState,
      telegramAvailable: telegram.available
    });

    // Runtime status is derived from the existing app and Telegram contexts so
    // auth, native controls, and route data keep their original ownership.
    return {
      ...status,
      online,
      mode: telegram.available ? 'telegram' : 'browser-preview',
      isTelegram: telegram.available,
      isPreview: !telegram.available,
      authState: telegramAuthState,
      initializationError,
      lastSyncedAt,
      safeArea: telegram.safeArea,
      contentSafeArea: telegram.contentSafeArea,
      viewport: telegram.viewport,
      retry
    };
  }, [
    initializationError,
    lastSyncedAt,
    loading,
    online,
    retry,
    telegramAuthState,
    telegram.available,
    telegram.contentSafeArea,
    telegram.safeArea,
    telegram.viewport
  ]);

  return (
    <MiniAppRuntimeContext.Provider value={value}>
      {children}
    </MiniAppRuntimeContext.Provider>
  );
}

export function useMiniAppRuntime() {
  const context = useContext(MiniAppRuntimeContext);
  if (!context) {
    throw new Error('useMiniAppRuntime must be used within MiniAppRuntimeProvider');
  }
  return context;
}
