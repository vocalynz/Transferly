/**
 * TransactionItem - Premium Transaction List Item
 * Beautiful transaction item with icon, amount, and status
 */

import React from 'react';

export function TransactionItem({
  icon: Icon,
  title,
  description,
  amount,
  currency,
  date,
  status,
  onClick,
}) {
  const statusColors = {
    completed: 'text-green-600 dark:text-green-400',
    pending: 'text-amber-600 dark:text-amber-400',
    failed: 'text-red-600 dark:text-red-400',
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[24px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-card-bg)] p-4 text-left text-[var(--tg-text-color)] transition-all duration-300 hover:translate-y-[-1px] hover:border-[var(--miniapp-accent-border)] hover:shadow-lg-glass"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {Icon && (
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[var(--miniapp-accent-soft)] text-[var(--tg-button-color)] flex items-center justify-center">
              <Icon className="w-5 h-5 text-current" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[var(--tg-text-color)] truncate">
              {title}
            </p>
            <p className="text-sm text-[var(--miniapp-shell-text-muted)] truncate">
              {description}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <p className={`font-bold ${statusColors[status] || 'text-[var(--tg-text-color)]'}`}>
            {amount} {currency}
          </p>
          <p className="text-xs text-[var(--miniapp-shell-text-muted)]">
            {date}
          </p>
        </div>
      </div>
    </button>
  );
}
