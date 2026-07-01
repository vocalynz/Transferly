const THEME_KEYS = {
  bg_color: '--tg-bg-color',
  text_color: '--tg-text-color',
  hint_color: '--tg-hint-color',
  link_color: '--tg-link-color',
  button_color: '--tg-button-color',
  button_text_color: '--tg-button-text-color',
  secondary_bg_color: '--tg-secondary-bg-color',
  section_bg_color: '--tg-section-bg-color',
  section_header_text_color: '--tg-section-header-text-color',
  subtitle_text_color: '--tg-subtitle-text-color',
  destructive_text_color: '--tg-destructive-text-color',
  header_bg_color: '--tg-header-bg-color',
  bottom_bar_bg_color: '--tg-bottom-bar-bg-color',
  accent_text_color: '--tg-accent-text-color'
};

const FALLBACK_THEME = {
  bg_color: '#0b1524',
  text_color: '#f5f8ff',
  hint_color: '#7f91a8',
  link_color: '#6ab3f3',
  button_color: '#2aabee',
  button_text_color: '#ffffff',
  secondary_bg_color: '#111f32',
  section_bg_color: '#15263a',
  section_header_text_color: '#6ab3f3',
  subtitle_text_color: '#8ea2b8',
  destructive_text_color: '#ff6b7a',
  header_bg_color: '#0b1524',
  bottom_bar_bg_color: '#0b1524',
  accent_text_color: '#6ab3f3'
};
const DEFAULT_SAFE_AREA = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0
};

function getRoot() {
  if (typeof document === 'undefined') {
    return null;
  }

  return document.documentElement;
}

export function getTelegramWebApp() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.Telegram?.WebApp || null;
}

export function isTelegramMiniApp() {
  return Boolean(getTelegramWebApp()?.initData);
}

export function getLaunchParam(name) {
  if (typeof window === 'undefined') {
    return '';
  }

  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  return hashParams.get(name) || url.searchParams.get(name) || '';
}

export function getTelegramStartParam(webApp = getTelegramWebApp()) {
  return (
    webApp?.initDataUnsafe?.start_param ||
    getLaunchParam('tgWebAppStartParam') ||
    getLaunchParam('startapp') ||
    getLaunchParam('start') ||
    ''
  );
}

export function getTelegramUser(webApp = getTelegramWebApp()) {
  return webApp?.initDataUnsafe?.user || null;
}

export function getRawTelegramInitData(webApp = getTelegramWebApp()) {
  return webApp?.initData || getLaunchParam('tgWebAppData') || '';
}

function normalizeInset(inset = {}) {
  return {
    top: Number(inset?.top || 0),
    right: Number(inset?.right || 0),
    bottom: Number(inset?.bottom || 0),
    left: Number(inset?.left || 0)
  };
}

export function getTelegramPlatform(webApp = getTelegramWebApp()) {
  return webApp?.platform || 'unknown';
}

export function getTelegramVersion(webApp = getTelegramWebApp()) {
  return webApp?.version || '';
}

function compareTelegramVersions(current, minimum) {
  const currentParts = String(current || '').split('.').map((part) => Number(part) || 0);
  const minimumParts = String(minimum || '').split('.').map((part) => Number(part) || 0);
  const length = Math.max(currentParts.length, minimumParts.length);

  for (let index = 0; index < length; index += 1) {
    const currentPart = currentParts[index] || 0;
    const minimumPart = minimumParts[index] || 0;
    if (currentPart > minimumPart) {
      return 1;
    }
    if (currentPart < minimumPart) {
      return -1;
    }
  }

  return 0;
}

export function isTelegramVersionAtLeast(webApp = getTelegramWebApp(), minimumVersion = '1.0') {
  if (!webApp) {
    return false;
  }

  if (typeof webApp.isVersionAtLeast === 'function') {
    try {
      return Boolean(webApp.isVersionAtLeast(minimumVersion));
    } catch (_error) {
      return false;
    }
  }

  const version = getTelegramVersion(webApp);
  if (!version) {
    return true;
  }

  return compareTelegramVersions(version, minimumVersion) >= 0;
}

function safeTelegramCall(callback) {
  try {
    callback?.();
  } catch (_error) {
    // Telegram WebApp method support varies by client version and platform.
  }
}

export function getTelegramColorScheme(webApp = getTelegramWebApp()) {
  return webApp?.colorScheme || webApp?.color_scheme || 'light';
}

export function getTelegramSafeArea(webApp = getTelegramWebApp()) {
  return {
    safeArea: normalizeInset(webApp?.safeAreaInset || DEFAULT_SAFE_AREA),
    contentSafeArea: normalizeInset(webApp?.contentSafeAreaInset || DEFAULT_SAFE_AREA)
  };
}

export function applyTelegramViewportVars(webApp = getTelegramWebApp()) {
  const root = getRoot();
  const safeArea = getTelegramSafeArea(webApp);

  if (!root) {
    return safeArea;
  }

  const viewportHeight = Number(webApp?.viewportHeight || (typeof window === 'undefined' ? 0 : window.innerHeight) || 0);
  const viewportStableHeight = Number(webApp?.viewportStableHeight || viewportHeight || 0);
  root.style.setProperty('--tg-viewport-height', viewportHeight ? `${viewportHeight}px` : '100vh');
  root.style.setProperty('--tg-viewport-stable-height', viewportStableHeight ? `${viewportStableHeight}px` : '100vh');

  Object.entries(safeArea.safeArea).forEach(([key, value]) => {
    root.style.setProperty(`--tg-safe-area-${key}`, `${value}px`);
  });
  Object.entries(safeArea.contentSafeArea).forEach(([key, value]) => {
    root.style.setProperty(`--tg-content-safe-area-${key}`, `${value}px`);
  });

  return safeArea;
}

export function applyTelegramTheme(themeParams = {}) {
  const root = getRoot();
  if (!root) {
    return FALLBACK_THEME;
  }

  const theme = {
    ...FALLBACK_THEME,
    ...(themeParams || {})
  };

  Object.entries(THEME_KEYS).forEach(([key, variable]) => {
    root.style.setProperty(variable, theme[key] || FALLBACK_THEME[key]);
  });

  const colorScheme = theme.bg_color === '#000000' || String(theme.bg_color).toLowerCase().startsWith('#1')
    ? 'dark'
    : 'light';
  root.dataset.telegramTheme = colorScheme;

  return theme;
}

export function initializeTelegramMiniApp() {
  const webApp = getTelegramWebApp();
  const theme = applyTelegramTheme(webApp?.themeParams);
  const safeArea = applyTelegramViewportVars(webApp);

  if (!webApp) {
    return {
      webApp: null,
      theme,
      user: null,
      startParam: getTelegramStartParam(null),
      initData: getRawTelegramInitData(null),
      platform: getTelegramPlatform(null),
      version: getTelegramVersion(null),
      colorScheme: getTelegramColorScheme(null),
      safeArea: safeArea.safeArea,
      contentSafeArea: safeArea.contentSafeArea,
      available: false
    };
  }

  safeTelegramCall(() => webApp.ready?.());
  safeTelegramCall(() => webApp.expand?.());

  if (isTelegramVersionAtLeast(webApp, '6.1')) {
    safeTelegramCall(() => webApp.setHeaderColor?.(theme.header_bg_color || theme.bg_color));
    safeTelegramCall(() => webApp.setBackgroundColor?.(theme.bg_color));
  }

  return {
    webApp,
    theme,
    user: getTelegramUser(webApp),
    startParam: getTelegramStartParam(webApp),
    initData: getRawTelegramInitData(webApp),
    platform: getTelegramPlatform(webApp),
    version: getTelegramVersion(webApp),
    colorScheme: getTelegramColorScheme(webApp),
    safeArea: safeArea.safeArea,
    contentSafeArea: safeArea.contentSafeArea,
    available: true
  };
}

export function configureTelegramMainButton(webApp, {
  text,
  visible = true,
  enabled = true,
  loading = false,
  color,
  textColor,
  onClick
} = {}) {
  const button = webApp?.MainButton;
  if (!button) {
    return () => {};
  }

  if (text) {
    button.setText?.(text);
  }

  if (color && textColor) {
    button.setParams?.({ color, text_color: textColor });
  }

  if (enabled) {
    button.enable?.();
  } else {
    button.disable?.();
  }

  if (loading) {
    button.showProgress?.();
  } else {
    button.hideProgress?.();
  }

  if (visible) {
    button.show?.();
  } else {
    button.hide?.();
  }

  if (onClick) {
    button.onClick?.(onClick);
  }

  return () => {
    if (onClick) {
      button.offClick?.(onClick);
    }
    button.hideProgress?.();
    button.hide?.();
  };
}

export function configureTelegramBackButton(webApp, {
  visible = true,
  onClick
} = {}) {
  const button = webApp?.BackButton;
  if (!button || !isTelegramVersionAtLeast(webApp, '6.1')) {
    return () => {};
  }

  if (visible) {
    safeTelegramCall(() => button.show?.());
  } else {
    safeTelegramCall(() => button.hide?.());
  }

  if (onClick) {
    safeTelegramCall(() => button.onClick?.(onClick));
  }

  return () => {
    if (onClick) {
      safeTelegramCall(() => button.offClick?.(onClick));
    }
    safeTelegramCall(() => button.hide?.());
  };
}

export function configureTelegramSettingsButton(webApp, {
  visible = true,
  onClick
} = {}) {
  const button = webApp?.SettingsButton;
  if (!button || !isTelegramVersionAtLeast(webApp, '7.0')) {
    return () => {};
  }

  if (visible) {
    safeTelegramCall(() => button.show?.());
  } else {
    safeTelegramCall(() => button.hide?.());
  }

  if (onClick) {
    safeTelegramCall(() => button.onClick?.(onClick));
  }

  return () => {
    if (onClick) {
      safeTelegramCall(() => button.offClick?.(onClick));
    }
  };
}

export function configureClosingConfirmation(webApp, enabled) {
  try {
    if (enabled) {
      webApp?.enableClosingConfirmation?.();
    } else {
      webApp?.disableClosingConfirmation?.();
    }
  } catch (_error) {
    // Closing confirmation is client/version dependent.
  }
}

export function configureVerticalSwipe(webApp, enabled) {
  try {
    if (enabled) {
      webApp?.enableVerticalSwipes?.();
    } else {
      webApp?.disableVerticalSwipes?.();
    }
  } catch (_error) {
    // Swipe behavior is client/version dependent.
  }
}

export function showTelegramPopup(options = {}) {
  return new Promise((resolve) => {
    try {
      const webApp = getTelegramWebApp();
      if (!webApp?.showPopup) {
        resolve(null);
        return;
      }
      webApp.showPopup(options, resolve);
    } catch (_error) {
      resolve(null);
    }
  });
}

export function showTelegramAlert(message) {
  return new Promise((resolve) => {
    try {
      const webApp = getTelegramWebApp();
      if (webApp?.showAlert) {
        webApp.showAlert(String(message || ''), resolve);
        return;
      }
      if (typeof window !== 'undefined' && window.alert) {
        window.alert(String(message || ''));
      }
      resolve(true);
    } catch (_error) {
      resolve(false);
    }
  });
}

export function showTelegramConfirm(message) {
  return new Promise((resolve) => {
    try {
      const webApp = getTelegramWebApp();
      if (webApp?.showConfirm) {
        webApp.showConfirm(String(message || ''), resolve);
        return;
      }
      if (typeof window !== 'undefined' && window.confirm) {
        resolve(window.confirm(String(message || '')));
        return;
      }
      resolve(true);
    } catch (_error) {
      resolve(false);
    }
  });
}

export function openTelegramLink(url, options = {}) {
  try {
    const target = String(url || '');
    const webApp = getTelegramWebApp();

    if (!target) {
      return false;
    }

    if (webApp?.openTelegramLink && target.startsWith('https://t.me/')) {
      webApp.openTelegramLink(target);
      return true;
    }

    if (webApp?.openLink) {
      webApp.openLink(target, options);
      return true;
    }

    if (typeof window !== 'undefined') {
      window.open(target, '_blank', 'noopener,noreferrer');
      return true;
    }
  } catch (_error) {
    return false;
  }

  return false;
}

export function shareTelegramUrl(url, text = '') {
  const target = String(url || '');
  if (!target) {
    return false;
  }

  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(target)}${text ? `&text=${encodeURIComponent(text)}` : ''}`;
  return openTelegramLink(shareUrl);
}

export function triggerTelegramImpact(style = 'light') {
  try {
    getTelegramWebApp()?.HapticFeedback?.impactOccurred?.(style);
  } catch (_error) {
    // Haptics are best-effort and unavailable in regular browsers.
  }
}

export function triggerTelegramNotification(type = 'success') {
  try {
    getTelegramWebApp()?.HapticFeedback?.notificationOccurred?.(type);
  } catch (_error) {
    // Haptics are best-effort and unavailable in regular browsers.
  }
}
