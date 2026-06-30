import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  applyTelegramTheme,
  applyTelegramViewportVars,
  configureClosingConfirmation,
  configureTelegramBackButton,
  configureTelegramMainButton,
  configureTelegramSettingsButton,
  configureVerticalSwipe,
  getRawTelegramInitData,
  getTelegramColorScheme,
  getTelegramPlatform,
  getTelegramSafeArea,
  getTelegramStartParam,
  getTelegramUser,
  getTelegramVersion,
  getTelegramWebApp,
  initializeTelegramMiniApp,
  openTelegramLink,
  shareTelegramUrl,
  showTelegramAlert,
  showTelegramConfirm,
  showTelegramPopup,
  triggerTelegramImpact,
  triggerTelegramNotification
} from '../lib/telegramMiniApp';

const TelegramMiniAppContext = createContext(null);
const HAPTICS_STORAGE_KEY = 'transferly_miniapp_haptics_enabled';
const DEFAULT_NATIVE_CONTROLS = {
  backButton: { visible: false },
  mainButton: { visible: false },
  settingsButton: { visible: false },
  closingConfirmation: false,
  verticalSwipe: true
};
const DEFAULT_SAFE_AREA = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0
};

function readStoredBoolean(key, fallback) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  const stored = window.localStorage.getItem(key);
  if (stored === null) {
    return fallback;
  }

  return stored === 'true';
}

export function TelegramMiniAppProvider({ children }) {
  const [state, setState] = useState(() => ({
    webApp: null,
    available: false,
    theme: {},
    user: null,
    startParam: '',
    initData: '',
    platform: 'unknown',
    version: '',
    colorScheme: 'light',
    safeArea: DEFAULT_SAFE_AREA,
    contentSafeArea: DEFAULT_SAFE_AREA,
    hapticsEnabled: readStoredBoolean(HAPTICS_STORAGE_KEY, true),
    viewport: {
      height: typeof window === 'undefined' ? 0 : window.innerHeight,
      stableHeight: typeof window === 'undefined' ? 0 : window.innerHeight,
      isExpanded: false
    }
  }));
  const [nativeControls, setNativeControlsState] = useState(DEFAULT_NATIVE_CONTROLS);

  useEffect(() => {
    const initialized = initializeTelegramMiniApp();
    const webApp = initialized.webApp;

    setState((previous) => ({
      ...previous,
      ...initialized,
      viewport: {
        height: webApp?.viewportHeight || previous.viewport.height,
        stableHeight: webApp?.viewportStableHeight || previous.viewport.stableHeight,
        isExpanded: Boolean(webApp?.isExpanded)
      }
    }));

    if (!webApp) {
      return undefined;
    }

    const handleThemeChanged = () => {
      const theme = applyTelegramTheme(webApp.themeParams);
      setState((previous) => ({
        ...previous,
        theme,
        colorScheme: getTelegramColorScheme(webApp)
      }));
    };

    const handleViewportChanged = () => {
      const safeArea = applyTelegramViewportVars(webApp);
      setState((previous) => ({
        ...previous,
        safeArea: safeArea.safeArea,
        contentSafeArea: safeArea.contentSafeArea,
        viewport: {
          height: webApp.viewportHeight || previous.viewport.height,
          stableHeight: webApp.viewportStableHeight || previous.viewport.stableHeight,
          isExpanded: Boolean(webApp.isExpanded)
        }
      }));
    };

    webApp.onEvent?.('themeChanged', handleThemeChanged);
    webApp.onEvent?.('viewportChanged', handleViewportChanged);

    return () => {
      webApp.offEvent?.('themeChanged', handleThemeChanged);
      webApp.offEvent?.('viewportChanged', handleViewportChanged);
    };
  }, []);

  const refresh = useCallback(() => {
    const webApp = getTelegramWebApp();
    const theme = applyTelegramTheme(webApp?.themeParams);
    const safeArea = applyTelegramViewportVars(webApp);

    setState((previous) => ({
      ...previous,
      webApp,
      available: Boolean(webApp),
      theme,
      user: getTelegramUser(webApp),
      startParam: getTelegramStartParam(webApp),
      initData: getRawTelegramInitData(webApp),
      platform: getTelegramPlatform(webApp),
      version: getTelegramVersion(webApp),
      colorScheme: getTelegramColorScheme(webApp),
      safeArea: safeArea.safeArea,
      contentSafeArea: safeArea.contentSafeArea,
      viewport: {
        height: webApp?.viewportHeight || previous.viewport.height,
        stableHeight: webApp?.viewportStableHeight || previous.viewport.stableHeight,
        isExpanded: Boolean(webApp?.isExpanded)
      }
    }));
  }, []);

  const setHapticsEnabled = useCallback((enabled) => {
    const nextValue = Boolean(enabled);

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(HAPTICS_STORAGE_KEY, String(nextValue));
    }

    setState((previous) => ({
      ...previous,
      hapticsEnabled: nextValue
    }));
  }, []);

  const setNativeControls = useCallback((controls = {}) => {
    setNativeControlsState((previous) => ({
      ...previous,
      ...controls
    }));
  }, []);

  const resetNativeControls = useCallback(() => {
    setNativeControlsState(DEFAULT_NATIVE_CONTROLS);
  }, []);

  const configureBackButton = useCallback((options = {}) => {
    setNativeControls({ backButton: options });
    return () => setNativeControls({ backButton: { visible: false } });
  }, [setNativeControls]);

  const configureMainButton = useCallback((options = {}) => {
    setNativeControls({ mainButton: options });
    return () => setNativeControls({ mainButton: { visible: false } });
  }, [setNativeControls]);

  const configureSettingsButton = useCallback((options = {}) => {
    setNativeControls({ settingsButton: options });
    return () => setNativeControls({ settingsButton: { visible: false } });
  }, [setNativeControls]);

  const configureClosing = useCallback((enabled) => {
    const nextEnabled = Boolean(enabled);
    setNativeControls({ closingConfirmation: nextEnabled });
    return () => setNativeControls({ closingConfirmation: false });
  }, [setNativeControls]);

  const configureSwipe = useCallback((enabled) => {
    const nextEnabled = Boolean(enabled);
    setNativeControls({ verticalSwipe: nextEnabled });
    return () => setNativeControls({ verticalSwipe: true });
  }, [setNativeControls]);

  useEffect(() => (
    configureTelegramBackButton(state.webApp, nativeControls.backButton)
  ), [nativeControls.backButton, state.webApp]);

  useEffect(() => (
    configureTelegramMainButton(state.webApp, nativeControls.mainButton)
  ), [nativeControls.mainButton, state.webApp]);

  useEffect(() => (
    configureTelegramSettingsButton(state.webApp, nativeControls.settingsButton)
  ), [nativeControls.settingsButton, state.webApp]);

  useEffect(() => {
    configureClosingConfirmation(state.webApp, nativeControls.closingConfirmation);
    return () => configureClosingConfirmation(state.webApp, false);
  }, [nativeControls.closingConfirmation, state.webApp]);

  useEffect(() => {
    configureVerticalSwipe(state.webApp, nativeControls.verticalSwipe);
    return () => configureVerticalSwipe(state.webApp, true);
  }, [nativeControls.verticalSwipe, state.webApp]);

  const impact = useCallback((style) => {
    if (state.hapticsEnabled) {
      triggerTelegramImpact(style);
    }
  }, [state.hapticsEnabled]);

  const notify = useCallback((type) => {
    if (state.hapticsEnabled) {
      triggerTelegramNotification(type);
    }
  }, [state.hapticsEnabled]);

  const showPopup = useCallback((options) => showTelegramPopup(options), []);
  const showAlert = useCallback((message) => showTelegramAlert(message), []);
  const showConfirm = useCallback((message) => showTelegramConfirm(message), []);
  const openLink = useCallback((url, options) => openTelegramLink(url, options), []);
  const shareUrl = useCallback((url, text) => shareTelegramUrl(url, text), []);

  const value = useMemo(() => ({
    ...state,
    nativeControls,
    refresh,
    setHapticsEnabled,
    setNativeControls,
    resetNativeControls,
    configureBackButton,
    configureClosingConfirmation: configureClosing,
    configureMainButton,
    configureSettingsButton,
    configureVerticalSwipe: configureSwipe,
    impact,
    notify,
    showPopup,
    showAlert,
    showConfirm,
    openLink,
    shareUrl,
    getSafeArea: () => getTelegramSafeArea(state.webApp)
  }), [
    configureBackButton,
    configureClosing,
    configureMainButton,
    configureSettingsButton,
    configureSwipe,
    impact,
    nativeControls,
    notify,
    openLink,
    refresh,
    resetNativeControls,
    setHapticsEnabled,
    setNativeControls,
    shareUrl,
    showAlert,
    showConfirm,
    showPopup,
    state
  ]);

  return (
    <TelegramMiniAppContext.Provider value={value}>
      {children}
    </TelegramMiniAppContext.Provider>
  );
}

export function useTelegramMiniApp() {
  const context = useContext(TelegramMiniAppContext);
  if (!context) {
    throw new Error('useTelegramMiniApp must be used inside TelegramMiniAppProvider');
  }

  return context;
}
