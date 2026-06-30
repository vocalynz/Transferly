/**
 * StatGrid - Responsive Stats Display Grid
 * Grid of statistics with icons, values, and optional trends
 */

import React from 'react';

export function StatGrid({ stats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, idx) => {
        const Icon = stat.icon;
        return (
          <div
            key={idx}
            className="rounded-[24px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-card-bg)] p-5 text-[var(--tg-text-color)] transition-all duration-300 hover:border-[var(--miniapp-accent-border)] hover:shadow-lg-glass"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--miniapp-shell-text-muted)]">
                {stat.label}
              </span>
              {Icon && (
                <Icon className="w-5 h-5 text-[var(--tg-button-color)] opacity-75" />
              )}
            </div>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black tracking-tight text-[var(--tg-text-color)]">
                {stat.value}
              </span>
              {stat.suffix && (
                <span className="pb-1 text-sm font-semibold text-[var(--miniapp-shell-text-muted)]">
                  {stat.suffix}
                </span>
              )}
            </div>
            {stat.trend && (
              <div className={`mt-3 text-xs font-bold ${stat.trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
                {stat.trend > 0 ? '↑' : '↓'} {Math.abs(stat.trend)}%
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
