'use client';

import { clsx } from 'clsx';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
} from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Width in Tailwind form (e.g. "max-w-lg"). Defaults to max-w-lg. */
  maxWidth?: string;
  /** Extra className for the dialog body. */
  className?: string;
  /** Describe the modal to screen-readers. */
  description?: string;
  /** Suppress the X close button (e.g. while a claim step is in progress). */
  hideClose?: boolean;
}

/**
 * Shared pixel-art modal chrome.
 *
 * Behavior
 * --------
 *  - `role="dialog"` + `aria-modal` + labelled by the visible title
 *  - Escape closes
 *  - Backdrop click closes
 *  - Focus trapped inside the dialog while open; restored to the
 *    previously-focused element on close
 *  - `overflow-hidden` applied to both <html> and <body> while any
 *    modal is open, so the page underneath doesn't scroll regardless
 *    of which element is the real scroll container.
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg',
  className,
  description,
  hideClose = false,
}: ModalProps) {
  const headingId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock document scroll while open. We lock both <html> and <body>
  // because sub-pages (which now use the default document scroller —
  // see globals.css) bubble wheel/scroll events up to <html>, and
  // locking only <body> would leave those scrollable behind the modal.
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, [open]);

  // Focus management: capture previous focus, focus the dialog, restore on close.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  // Focus trap: when Tab would move outside, cycle back.
  const onKeyCapture = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const root = dialogRef.current;
    if (!root) return;
    const focusables = root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => {
        // backdrop click = close; clicks inside the dialog stop-propagation below
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onKeyDown={onKeyCapture}
        className={clsx(
          'relative w-full bg-bg-primary border-[2px] border-accent-cyan',
          'shadow-[4px_4px_0_0_#000] p-5 outline-none',
          'max-h-[85vh] overflow-auto',
          maxWidth,
          className,
        )}
      >
        <div className="flex items-start justify-between mb-4 gap-3">
          <h2
            id={headingId}
            className="text-accent-cyan text-sm uppercase tracking-widest"
          >
            {title}
          </h2>
          {!hideClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="text-text-muted hover:text-accent-cyan text-xs border-[2px] border-text-muted/40 hover:border-accent-cyan w-6 h-6 flex items-center justify-center"
            >
              ×
            </button>
          )}
        </div>
        {description && (
          <p id={descId} className="sr-only">
            {description}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
