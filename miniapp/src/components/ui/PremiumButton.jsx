/**
 * PremiumButton - Enhanced Button Component with Variants
 * Flexible button with multiple variants (primary, secondary, outline, ghost)
 */

import React from 'react';

export function PremiumButton({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon: Icon,
  onClick,
  disabled = false,
  className = '',
  ...props
}) {
  const variants = {
    primary: 'bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)] hover:brightness-110',
    secondary: 'bg-[var(--tg-secondary-bg-color)] text-[var(--tg-text-color)] hover:brightness-110',
    outline: 'border-2 border-[var(--miniapp-border-color)] text-[var(--tg-text-color)] hover:bg-[var(--miniapp-nav-hover-bg)]',
    ghost: 'text-[var(--tg-text-color)] hover:bg-[var(--miniapp-nav-hover-bg)]',
  };

  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-5 py-3 text-base',
    lg: 'px-6 py-4 text-lg',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center justify-center gap-2 rounded-full font-bold
        transition-all duration-300 ease-out
        disabled:opacity-50 disabled:cursor-not-allowed
        hover:shadow-md-glass active:scale-95
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      {...props}
    >
      {isLoading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
      {Icon && !isLoading && <Icon size={18} />}
      {children}
    </button>
  );
}
