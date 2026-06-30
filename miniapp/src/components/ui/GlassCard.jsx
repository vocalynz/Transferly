/**
 * GlassCard - Glassmorphism Container with Premium Styling
 * Creates beautiful frosted glass effect cards with smooth interactions
 */

import React from 'react';

export function GlassCard({ children, className = '', interactive = true }) {
  return (
    <div className={`
      backdrop-blur-md bg-white/70 dark:bg-slate-900/40
      rounded-3xl border border-white/20 dark:border-white/10
      shadow-lg-glass hover:shadow-xl-glass
      transition-all duration-300 ease-out
      ${interactive ? 'hover:translate-y-[-2px] cursor-pointer' : ''}
      ${className}
    `}>
      {children}
    </div>
  );
}
