/**
 * LoadingSkeletonCard - Premium Loading State with Shimmer Animation
 * Beautiful loading placeholders with shimmer effect for perceived performance
 */

import React from 'react';

export function LoadingSkeletonCard({ count = 1, height = 'h-20' }) {
  return (
    <>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className={`
            ${height} rounded-2xl bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200
            dark:from-slate-700 dark:via-slate-600 dark:to-slate-700
            animate-shimmer
          `}
          style={{
            backgroundSize: '1000px 100%',
            animation: 'shimmer 2s infinite',
          }}
        />
      ))}
    </>
  );
}
