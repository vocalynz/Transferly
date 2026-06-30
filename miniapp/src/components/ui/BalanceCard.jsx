/**
 * BalanceCard - Interactive Balance Display with Visibility Toggle
 * Beautiful balance card with show/hide functionality
 */

import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function BalanceCard({ label, balance, currency = 'USD', isVisible = true }) {
  const [showBalance, setShowBalance] = React.useState(isVisible);
  const ToggleIcon = showBalance ? Eye : EyeOff;

  return (
    <div className="rounded-[28px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-card-bg)] p-6 text-[var(--tg-text-color)] shadow-[0_18px_48px_rgba(0,0,0,0.18)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--miniapp-shell-text-muted)]">
          {label}
        </h3>
        <button
          type="button"
          onClick={() => setShowBalance(!showBalance)}
          aria-label={showBalance ? 'Hide balance' : 'Show balance'}
          className="miniapp-pressable inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--miniapp-accent-soft)] text-[var(--tg-button-color)] transition hover:brightness-110"
        >
          <ToggleIcon size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-end gap-2">
        <span className="text-4xl font-black tracking-tight text-[var(--tg-text-color)]">
          {showBalance ? balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '•••••'}
        </span>
        <span className="pb-2 text-lg font-semibold text-[var(--miniapp-shell-text-muted)]">
          {currency}
        </span>
      </div>
    </div>
  );
}
