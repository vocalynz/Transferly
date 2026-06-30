import React from 'react';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

const stateTone = {
  loading: {
    icon: Loader2,
    iconClassName: 'animate-spin text-[var(--tg-button-color)]',
    title: 'Loading workspace',
    description: 'Preparing your wallet command center.'
  },
  empty: {
    icon: AlertCircle,
    iconClassName: 'text-[var(--tg-hint-color)]',
    title: 'Nothing here yet',
    description: 'New activity will appear here as soon as it is available.'
  },
  success: {
    icon: CheckCircle2,
    iconClassName: 'text-emerald-500',
    title: 'Done',
    description: 'Your action was completed.'
  },
  error: {
    icon: AlertCircle,
    iconClassName: 'text-red-500',
    title: 'Unable to load this view',
    description: 'Try again or return to another section.'
  }
};

export function MiniAppState({
  tone = 'loading',
  title,
  description,
  actionLabel,
  onAction,
  compact = false
}) {
  const config = stateTone[tone] || stateTone.loading;
  const Icon = config.icon;

  return (
    <main
      className={`flex w-full items-center justify-center px-5 text-center ${compact ? 'min-h-[240px]' : 'min-h-screen bg-[var(--tg-bg-color,#f5f7fb)]'}`}
    >
      <section
        className="flex max-w-sm flex-col items-center gap-4"
        role={tone === 'error' ? 'alert' : 'status'}
        aria-live={tone === 'loading' ? 'polite' : 'assertive'}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <Icon className={`h-6 w-6 ${config.iconClassName}`} aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-lg font-black text-[var(--tg-text-color,#111827)]">
            {title || config.title}
          </h1>
          <p className="text-sm font-semibold leading-6 text-[var(--tg-hint-color,#64748b)]">
            {description || config.description}
          </p>
        </div>
        {onAction && (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-[var(--tg-button-color,#229ed9)] px-5 text-sm font-black text-[var(--tg-button-text-color,#ffffff)] shadow-sm transition active:scale-[0.98]"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            {actionLabel || 'Try again'}
          </button>
        )}
      </section>
    </main>
  );
}
