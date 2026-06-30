/**
 * PremiumInput - Enhanced Form Input with Floating Label
 * Premium form input with icon support and smooth animations
 */

import React from 'react';

export function PremiumInput({
  id,
  type = 'text',
  label,
  value = '',
  onChange,
  onBlur,
  error,
  helperText,
  icon: Icon,
  disabled = false,
  success = false,
  className = '',
  inputClassName = '',
  ...props
}) {
  const [focused, setFocused] = React.useState(false);
  const generatedId = React.useId();
  const inputId = id || `premium-input-${generatedId}`;
  const messageId = error || helperText ? `${inputId}-message` : undefined;

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label htmlFor={inputId} className={`
          absolute left-4 transition-all duration-200 pointer-events-none font-medium
          ${focused || value
            ? 'top-2 text-xs text-slate-500 dark:text-slate-400'
            : 'top-3.5 text-base text-slate-400 dark:text-slate-500'
          }
        `}>
          {label}
        </label>
      )}

      <div className="relative">
        {Icon && (
          <Icon className={`
            absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5
            transition-colors duration-200
            ${focused ? 'text-[var(--tg-button-color)]' : 'text-slate-400'}
            ${disabled ? 'opacity-50' : ''}
          `} />
        )}

        <input
          id={inputId}
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          disabled={disabled}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={messageId}
          className={`
            w-full ${label ? 'pt-6 pb-2' : 'py-3'} ${Icon ? 'pl-10' : 'px-4'} pr-4
            border-b-2 bg-transparent dark:bg-slate-900/30
            transition-all duration-200 outline-none font-medium
            border-slate-200 dark:border-slate-700
            focus:border-[var(--tg-button-color)] dark:focus:border-[var(--tg-button-color)]
            placeholder-slate-400 dark:placeholder-slate-500
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'border-red-500 dark:border-red-400 focus:border-red-600' : ''}
            ${success && !error ? 'border-emerald-500 dark:border-emerald-400 focus:border-emerald-500' : ''}
            ${inputClassName}
          `}
          {...props}
        />
      </div>

      {error && (
        <p id={messageId} className="miniapp-field-message mt-2 text-sm font-medium text-red-500 dark:text-red-400">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={messageId} className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {helperText}
        </p>
      )}
    </div>
  );
}
