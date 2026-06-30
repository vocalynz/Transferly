/**
 * ConfirmationModal - Premium Modal Dialog with Animations
 * Beautiful confirmation modal with backdrop blur and smooth transitions
 */

import React from 'react';
import { X } from 'lucide-react';

export function ConfirmationModal({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isDangerous = false,
  isLoading = false,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm animate-fade-in"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 rounded-[28px] border border-[var(--miniapp-border-color)] bg-[var(--miniapp-card-bg)] p-8 text-[var(--tg-text-color)] shadow-elevated animate-slide-up">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close dialog"
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[var(--miniapp-accent-soft)] text-[var(--miniapp-shell-text-muted)] transition-colors hover:text-[var(--tg-text-color)]"
        >
          <X size={20} aria-hidden="true" />
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-black tracking-tight text-[var(--tg-text-color)]">
            {title}
          </h2>
          {description && (
            <p className="mt-3 text-base leading-relaxed text-[var(--miniapp-shell-text-muted)]">
              {description}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 px-4 py-3 rounded-full border border-[var(--miniapp-border-color)] bg-[var(--tg-secondary-bg-color)] text-[var(--tg-text-color)] font-bold transition-all hover:brightness-110 disabled:opacity-50"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`
              flex-1 px-4 py-3 rounded-full font-bold transition-all
              ${isDangerous
                ? 'bg-[var(--tg-destructive-text-color)] text-white hover:brightness-110'
                : 'bg-[var(--tg-button-color)] text-[var(--tg-button-text-color)] hover:brightness-110'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
              inline-flex items-center justify-center gap-2
            `}
          >
            {isLoading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
