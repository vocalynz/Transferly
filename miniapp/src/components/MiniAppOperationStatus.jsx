import React from 'react';
import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';

const STATUS_META = {
  loading: {
    icon: Loader2,
    label: 'Working',
    className: 'text-[var(--tg-button-color)]'
  },
  success: {
    icon: CheckCircle2,
    label: 'Complete',
    className: 'text-emerald-500'
  },
  error: {
    icon: AlertCircle,
    label: 'Needs attention',
    className: 'text-[var(--tg-destructive-text-color)]'
  },
  retry: {
    icon: RefreshCw,
    label: 'Retry available',
    className: 'text-[var(--tg-destructive-text-color)]'
  }
};

export default function MiniAppOperationStatus({
  status = 'idle',
  title,
  description,
  actionLabel,
  onAction
}) {
  if (status === 'idle') {
    return null;
  }

  const meta = STATUS_META[status] || STATUS_META.loading;
  const Icon = meta.icon;
  const isLoading = status === 'loading';
  const liveRole = status === 'error' || status === 'retry' ? 'alert' : 'status';

  return (
    <section
      role={liveRole}
      aria-live="polite"
      className="rounded-[22px] border border-[color:var(--tg-section-separator-color,rgba(148,163,184,0.24))] bg-[var(--tg-secondary-bg-color)] p-4"
    >
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--tg-bg-color)] ${meta.className}`}>
          <Icon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--tg-hint-color)]">
            {meta.label}
          </p>
          {title ? (
            <p className="mt-1 text-sm font-semibold text-[var(--tg-text-color)]">
              {title}
            </p>
          ) : null}
          {description ? (
            <p className="mt-1 text-sm leading-5 text-[var(--tg-subtitle-text-color)]">
              {description}
            </p>
          ) : null}
        </div>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            className="shrink-0 rounded-full bg-[var(--tg-button-color)] px-3 py-2 text-xs font-semibold text-[var(--tg-button-text-color)] transition active:scale-[0.98]"
          >
            {actionLabel}
          </button>
        ) : null}
      </div>
    </section>
  );
}
