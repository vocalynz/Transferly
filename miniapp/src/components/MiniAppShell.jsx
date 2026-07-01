import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bot,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Copy,
  HelpCircle,
  Home,
  Mail,
  Megaphone,
  MessageCircle,
  Moon,
  Settings,
  ShieldAlert,
  Sparkles,
  Sun,
  Users,
  WalletCards,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAppContext } from '../context/AppContext';
import { useTelegramMiniApp } from '../context/TelegramMiniAppContext';

const railItems = [
  { label: 'Wallet Home', to: '/miniapp', icon: Home },
  { label: 'Services', to: '/miniapp/services', icon: Sparkles },
  { label: 'Vault', to: '/miniapp/vault', icon: Clock3 },
  { label: 'Studio', to: '/miniapp/studio', icon: Mail },
  { label: 'Referral', to: '/miniapp/profile', icon: Users },
  { label: 'Settings', to: '/miniapp/settings', icon: Settings }
];

const bottomItems = [
  { label: 'Wallet', to: '/miniapp', icon: Home },
  { label: 'Services', to: '/miniapp/services', icon: Sparkles },
  { label: 'Studio', to: '/miniapp/studio', icon: Mail },
  { label: 'Points', to: '/miniapp/wallet', icon: WalletCards },
  { label: 'Settings', to: '/miniapp/settings', icon: Settings }
];

const COMMUNITY_MODAL_KEY = 'transferly_telegram_modal_dismissed';
const THEME_STORAGE_KEY = 'transferly_miniapp_theme';

const communityPoints = [
  { icon: HelpCircle, text: 'Get help & answers to your questions' },
  { icon: WalletCards, text: 'Learn how to buy & manage points' },
  { icon: ShieldAlert, text: 'Report orders that have not released points' },
  { icon: Megaphone, text: 'Updates, tips & community support' }
];

function formatName(telegramUser, profile, user) {
  const telegramName = [telegramUser?.first_name, telegramUser?.last_name].filter(Boolean).join(' ');
  return telegramName || profile?.name || user?.name || user?.email || 'Transferly user';
}

function initialsFromName(displayName) {
  return displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0].toUpperCase())
    .join('') || 'TR';
}

function getSessionLabel(telegram, telegramAuthState) {
  if (!telegram.available) {
    return 'Browser preview mode';
  }

  if (telegramAuthState === 'authenticated') {
    return 'Telegram session secured';
  }

  if (telegramAuthState === 'authenticating') {
    return 'Securing Telegram session';
  }

  if (telegramAuthState === 'failed') {
    return 'Telegram sign-in needs retry';
  }

  return 'Telegram session detected';
}

function getSessionTone(telegram, telegramAuthState, user) {
  if (telegramAuthState === 'failed') {
    return 'text-[var(--tg-destructive-text-color)]';
  }

  if (telegram.available && telegramAuthState === 'authenticated' && user?.id) {
    return 'text-emerald-500';
  }

  if (telegram.available || telegramAuthState === 'authenticating') {
    return 'text-[var(--tg-button-color)]';
  }

  return 'text-[var(--miniapp-shell-text-muted)]';
}

function readStoredThemeMode() {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  return window.localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
}

export default function MiniAppShell({
  children,
  title = 'Transferly Mini App',
  subtitle = 'Telegram-native command center',
  immersive = false
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, telegramAuthState } = useAppContext();
  const telegram = useTelegramMiniApp();
  const { configureBackButton, configureSettingsButton, impact } = telegram;
  const isRoot = location.pathname === '/miniapp';
  const [showCommunityModal, setShowCommunityModal] = useState(false);
  const [themeMode, setThemeMode] = useState(readStoredThemeMode);
  const displayName = formatName(telegram.user, profile, user);
  const initials = initialsFromName(displayName);
  const sessionLabel = getSessionLabel(telegram, telegramAuthState);
  const sessionTone = getSessionTone(telegram, telegramAuthState, user);
  const points = Number(profile?.points || 0);
  const currentScreen = isRoot ? 'home' : location.pathname.replace('/miniapp/', '') || 'home';
  const settingsPath = `/miniapp/settings?from=${encodeURIComponent(currentScreen)}`;
  const lightMode = themeMode === 'light';

  const referralLink = useMemo(() => {
    const referralCode = profile?.referral_code;
    return referralCode
      ? `https://t.me/TransferlyBot?start=${encodeURIComponent(referralCode)}`
      : 'https://t.me/TransferlyBot';
  }, [profile?.referral_code]);

  const copyReferral = async () => {
    if (!referralLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(referralLink);
      telegram.notify('success');
      toast.success('Referral link copied');
    } catch (_error) {
      telegram.notify('error');
      toast.error('Unable to copy referral link');
    }
  };

  const dismissCommunityModal = () => {
    setShowCommunityModal(false);
    try {
      window.localStorage.setItem(COMMUNITY_MODAL_KEY, 'true');
    } catch (_error) {
      // Ignore storage restrictions in embedded webviews.
    }
  };

  const toggleTheme = () => {
    const nextMode = lightMode ? 'dark' : 'light';
    setThemeMode(nextMode);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextMode);
    } catch (_error) {
      // Ignore storage restrictions in embedded webviews.
    }

    impact('light');
  };

  useEffect(() => {
    if (!isRoot || typeof window === 'undefined') {
      return;
    }

    try {
      setShowCommunityModal(window.localStorage.getItem(COMMUNITY_MODAL_KEY) !== 'true');
    } catch (_error) {
      setShowCommunityModal(true);
    }
  }, [isRoot]);

  const handleNativeBack = useCallback(() => {
    if (window.history.length > 1 && !isRoot) {
      navigate(-1);
    } else {
      navigate('/miniapp');
    }
  }, [isRoot, navigate]);

  useEffect(() => {
    return configureBackButton?.({
      visible: !isRoot,
      onClick: handleNativeBack
    });
  }, [configureBackButton, handleNativeBack, isRoot]);

  const handleNativeSettings = useCallback(() => {
    impact('light');
    navigate(settingsPath);
  }, [impact, navigate, settingsPath]);

  useEffect(() => {
    const cleanup = configureSettingsButton?.({
      visible: true,
      onClick: handleNativeSettings
    });

    return () => {
      cleanup?.();
    };
  }, [configureSettingsButton, handleNativeSettings]);

  const renderNavItem = (item, compact = false) => {
    const Icon = item.icon;
    const active = item.to === '/miniapp'
      ? location.pathname === '/miniapp'
      : location.pathname.startsWith(item.to);

    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={() => telegram.impact('light')}
        className={`miniapp-pressable group relative flex items-center justify-center overflow-hidden ${
          compact
            ? `h-14 flex-col gap-1 rounded-[18px] text-[10px] font-black ${active ? 'miniapp-active-shadow border border-[var(--miniapp-accent-border)] bg-[var(--miniapp-nav-active-bg)] text-[var(--miniapp-nav-active-text)]' : 'text-[var(--miniapp-nav-idle-text)] hover:bg-[var(--miniapp-nav-hover-bg)] hover:text-[var(--miniapp-shell-text)]'}`
            : `h-12 w-12 rounded-[19px] ${active ? 'miniapp-active-shadow border border-[var(--miniapp-accent-border)] bg-[var(--miniapp-nav-active-bg)] text-[var(--miniapp-nav-active-text)]' : 'text-[var(--miniapp-nav-idle-text)] hover:bg-[var(--miniapp-nav-hover-bg)] hover:text-[var(--miniapp-shell-text)]'}`
        }`}
        aria-label={item.label}
        title={item.label}
      >
        {active ? (
          <span
            className={`absolute rounded-full ${
              compact
                ? 'inset-x-5 top-1 h-0.5 bg-[var(--tg-button-color)]'
                : 'left-1 top-1/2 h-5 w-1 -translate-y-1/2 bg-[var(--tg-button-color)]'
            }`}
          />
        ) : null}
        <Icon size={compact ? 18 : 20} className="relative z-10" />
        {compact ? <span className="relative z-10">{item.label}</span> : null}
      </Link>
    );
  };

  if (immersive) {
    return (
      <div className={`transferly-miniapp-skin ${lightMode ? 'transferly-miniapp-skin-light' : ''} min-h-screen bg-[var(--tg-bg-color)] text-[var(--tg-text-color)]`}>
        {children}
      </div>
    );
  }

  return (
    <div className={`transferly-miniapp-skin ${lightMode ? 'transferly-miniapp-skin-light' : ''} min-h-screen text-[var(--tg-text-color)]`}>
      <div className="flex min-h-screen w-full">
        <aside className="miniapp-elevated-surface sticky top-0 hidden h-screen w-[86px] shrink-0 flex-col items-center border-r border-[var(--miniapp-border-color)] bg-[var(--miniapp-shell-bg)] px-3 py-4 backdrop-blur-2xl md:flex">
          <Link
            to="/miniapp"
            className="miniapp-pressable miniapp-logo-mark flex h-[52px] w-[52px] items-center justify-center rounded-[23px] text-sm font-black"
            aria-label="Transferly dashboard"
          >
            TR
          </Link>

          <nav className="mt-8 flex flex-1 flex-col items-center gap-3">
            {railItems.map((item) => renderNavItem(item))}
          </nav>

          <a
            href="https://t.me/+DhQqLRVqOHpmMmQ0"
            target="_blank"
            rel="noreferrer"
            className="miniapp-pressable flex h-12 w-12 items-center justify-center rounded-full bg-[#229ed9] text-white shadow-[0_18px_40px_rgba(34,158,217,0.24)]"
            aria-label="Open Telegram community"
          >
            <MessageCircle size={20} />
          </a>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col pb-[calc(84px+env(safe-area-inset-bottom))] md:pb-0">
          <header className="sticky top-0 z-30 border-b border-[var(--miniapp-border-color)] bg-[var(--miniapp-header-bg)] px-4 py-3 shadow-[0_12px_44px_rgba(0,0,0,0.12)] backdrop-blur-2xl md:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => (isRoot ? telegram.webApp?.close?.() : navigate(-1))}
                  className="miniapp-pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--miniapp-border-color)] bg-[var(--miniapp-panel-bg)] text-[var(--miniapp-shell-text-muted)] md:hidden"
                  aria-label={isRoot ? 'Close Mini App' : 'Go back'}
                >
                  <ChevronLeft size={18} />
                </button>
                <Link
                  to="/miniapp"
                  className="miniapp-pressable miniapp-logo-mark flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] text-xs font-black md:hidden"
                  aria-label="Transferly dashboard"
                >
                  TR
                </Link>
                <div className="min-w-0 md:hidden">
                  <p className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-[var(--miniapp-shell-text-muted)]">
                    {subtitle}
                  </p>
                  <h1 className="truncate text-lg font-black text-[var(--miniapp-shell-text)] md:text-xl">
                    {title}
                  </h1>
                </div>
                <button
                  type="button"
                  onClick={copyReferral}
                  className="miniapp-pressable hidden items-center gap-2 rounded-full border border-[var(--miniapp-border-color)] bg-[var(--miniapp-panel-bg)] px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-[var(--miniapp-shell-text-muted)] hover:text-[var(--miniapp-shell-text)] md:inline-flex"
                >
                  <Users size={14} className="text-[var(--tg-button-color)]" />
                  Referred: {Number(profile?.referral_count || 0).toLocaleString()}
                  <Copy size={13} />
                </button>
              </div>

              <div className="hidden min-w-0 items-center gap-3 sm:flex">
                <Link
                  to="/miniapp/profile"
                  className="miniapp-pressable inline-flex items-center gap-2 rounded-full border border-[var(--miniapp-border-color)] bg-[var(--miniapp-panel-bg)] px-2.5 py-2 text-[var(--miniapp-shell-text)]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--tg-button-color)] text-xs font-black text-[var(--tg-button-text-color)]">
                    {initials}
                  </span>
                  <span className="hidden min-w-0 text-left md:block">
                    <span className="block max-w-[120px] truncate text-xs font-black">{displayName}</span>
                    <span className="block text-[11px] font-black text-[var(--miniapp-shell-text-muted)]">{points.toLocaleString()}pts</span>
                  </span>
                </Link>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="miniapp-pressable inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--miniapp-border-color)] bg-[var(--miniapp-panel-bg)] text-[var(--miniapp-shell-text-muted)] hover:text-[var(--miniapp-shell-text)]"
                  aria-label="Toggle theme"
                  title="Toggle theme"
                >
                  {lightMode ? <Moon size={17} /> : <Sun size={17} />}
                </button>
              </div>
            </div>

            <div className="mt-3 grid gap-2 sm:hidden">
              <div className="flex items-center justify-between gap-3 rounded-[18px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-panel-bg)] px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-black text-[var(--miniapp-shell-text-muted)]">{sessionLabel}</p>
                  <p className="truncate text-sm font-black text-[var(--miniapp-shell-text)]">{displayName}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="miniapp-pressable flex h-9 w-9 items-center justify-center rounded-full bg-[var(--tg-secondary-bg-color)] text-[var(--tg-text-color)]"
                    aria-label="Toggle theme"
                    title="Toggle theme"
                  >
                    {lightMode ? <Moon size={16} /> : <Sun size={16} />}
                  </button>
                  <Link
                    to="/miniapp/wallet"
                    className="miniapp-pressable rounded-full bg-[var(--tg-button-color)] px-3 py-2 text-xs font-black text-[var(--tg-button-text-color)]"
                  >
                    {points.toLocaleString()}pts
                  </Link>
                </div>
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-4 md:px-6 md:py-6">
            {children}
          </main>

          <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--miniapp-border-color)] bg-[var(--miniapp-bottom-bg)] px-3 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 backdrop-blur-2xl md:hidden">
            <div className="mx-auto grid max-w-[640px] grid-cols-5 gap-1 rounded-[24px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-bottom-panel-bg)] p-1 shadow-[0_18px_45px_rgba(0,0,0,0.22)]">
              {bottomItems.map((item) => renderNavItem(item, true))}
            </div>
          </nav>

          <div className={`pointer-events-none fixed right-4 top-[96px] hidden rounded-full border border-[var(--miniapp-border-color)] bg-[var(--miniapp-panel-bg)] px-3 py-2 text-xs font-black shadow-lg lg:flex lg:items-center lg:gap-2 ${sessionTone}`}>
            <Bot size={14} />
            {sessionLabel}
          </div>

          {showCommunityModal ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 px-4 py-6 backdrop-blur-sm">
              <section className="miniapp-enter relative w-full max-w-[420px] rounded-[30px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-card-bg)] p-5 text-[var(--tg-text-color)] shadow-[0_26px_90px_rgba(0,0,0,0.6)]">
                <button
                  type="button"
                  onClick={dismissCommunityModal}
                  className="miniapp-pressable absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--miniapp-accent-soft)] text-[var(--miniapp-shell-text-muted)] hover:text-[var(--miniapp-shell-text)]"
                  aria-label="Close community prompt"
                >
                  <X size={18} />
                </button>
                <div className="miniapp-brand-mark flex h-16 w-16 items-center justify-center rounded-[24px] bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)]">
                  <MessageCircle size={30} />
                </div>
                <h2 className="mt-5 pr-10 text-2xl font-black tracking-[-0.04em]">Join our Telegram Community</h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-[var(--miniapp-shell-text-muted)]">
                  Stay connected for updates, support & more.
                </p>

                <div className="mt-5 space-y-2">
                  {communityPoints.map((point) => {
                    const Icon = point.icon;
                    return (
                      <div key={point.text} className="flex items-center gap-3 rounded-[20px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-panel-bg)] px-3 py-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[15px] bg-[var(--miniapp-accent-soft)] text-[var(--tg-button-color)]">
                          <Icon size={18} />
                        </span>
                        <span className="text-sm font-bold leading-5 text-[var(--miniapp-shell-text)]">{point.text}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-6 grid gap-3">
                  <a
                    href="https://t.me/+DhQqLRVqOHpmMmQ0"
                    target="_blank"
                    rel="noreferrer"
                    onClick={dismissCommunityModal}
                    className="miniapp-pressable miniapp-brand-mark flex items-center justify-center gap-2 rounded-[20px] bg-[var(--tg-button-color)] px-5 py-3 text-sm font-black text-[var(--tg-button-text-color)]"
                  >
                    <MessageCircle size={17} />
                    Join Telegram Channel
                  </a>
                  <button
                    type="button"
                    onClick={dismissCommunityModal}
                    className="miniapp-pressable flex items-center justify-center gap-2 rounded-[20px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-panel-bg)] px-5 py-3 text-sm font-black text-[var(--miniapp-shell-text)]"
                  >
                    <CheckCircle2 size={17} />
                    I've already joined
                  </button>
                </div>
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
