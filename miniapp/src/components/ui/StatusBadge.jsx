/**
 * StatusBadge - Animated Status Indicator with 6 States
 * Shows status with animated dot and semantic colors
 */

import React from 'react';

export function StatusBadge({ status = 'pending', animated = true, size = 'md' }) {
  const statusConfig = {
    pending: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      text: 'text-amber-700 dark:text-amber-300',
      dot: 'bg-amber-500',
      label: 'Pending',
    },
    processing: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      text: 'text-blue-700 dark:text-blue-300',
      dot: 'bg-blue-500',
      label: 'Processing',
    },
    completed: {
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      text: 'text-emerald-700 dark:text-emerald-300',
      dot: 'bg-emerald-500',
      label: 'Completed',
    },
    failed: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      text: 'text-red-700 dark:text-red-300',
      dot: 'bg-red-500',
      label: 'Failed',
    },
    approved: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      text: 'text-green-700 dark:text-green-300',
      dot: 'bg-green-500',
      label: 'Approved',
    },
    rejected: {
      bg: 'bg-rose-50 dark:bg-rose-900/20',
      text: 'text-rose-700 dark:text-rose-300',
      dot: 'bg-rose-500',
      label: 'Rejected',
    },
  };

  const config = statusConfig[status] || statusConfig.pending;
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  return (
    <div className={`
      inline-flex items-center gap-2 rounded-full
      ${config.bg} ${sizeClasses[size]}
    `}>
      <div className={`
        w-2 h-2 rounded-full ${config.dot}
        ${animated ? 'animate-pulse-subtle' : ''}
      `} />
      <span className={`font-semibold uppercase tracking-wider ${config.text}`}>
        {config.label}
      </span>
    </div>
  );
}
