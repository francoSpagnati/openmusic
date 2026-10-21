'use client';

import React from 'react';
import { CheckCircle, Info, WarningCircle, X } from '@phosphor-icons/react';
import { cn } from './cn';

export type ToastTone = 'neutral' | 'success' | 'error';

export interface ToastOptions {
  title: string;
  description?: string;
  tone?: ToastTone;
  /** Optional single action, e.g. Undo (Nielsen #3). */
  action?: { label: string; onAction: () => void };
  /** ms before auto-dismiss; 0 keeps it until dismissed. Default 5000 (8000 with an action). */
  duration?: number;
}

interface ToastRecord extends ToastOptions {
  id: number;
}

export interface ToastApi {
  notify: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = React.createContext<ToastApi | null>(null);

/** Access the notifier. Must be rendered inside <ToastProvider>. */
export function useToast(): ToastApi {
  const api = React.useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>');
  return api;
}

const toneIcon: Record<ToastTone, React.ReactNode> = {
  neutral: <Info weight="fill" className="h-5 w-5 text-accent" />,
  success: <CheckCircle weight="fill" className="h-5 w-5 text-fresh" />,
  error: <WarningCircle weight="fill" className="h-5 w-5 text-rotten" />,
};

function ToastItem({ toast, onDismiss }: { toast: ToastRecord; onDismiss: (id: number) => void }) {
  const { id, title, description, tone = 'neutral', action } = toast;
  const duration = toast.duration ?? (action ? 8000 : 5000);
  const [paused, setPaused] = React.useState(false);

  React.useEffect(() => {
    if (duration === 0 || paused) return;
    const timer = window.setTimeout(() => onDismiss(id), duration);
    return () => window.clearTimeout(timer);
  }, [duration, paused, id, onDismiss]);

  return (
    <li
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className={cn(
        'pointer-events-auto flex w-full items-start gap-3 rounded-sleeve border bg-elevated px-4 py-3 shadow-om-lg animate-toast-in',
        tone === 'error' ? 'border-rotten/50' : 'border-line'
      )}
    >
      <span aria-hidden="true" className="mt-0.5 shrink-0">
        {toneIcon[tone]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description && <p className="mt-0.5 text-sm text-ink-secondary">{description}</p>}
      </div>
      {action && (
        <button
          type="button"
          onClick={() => {
            action.onAction();
            onDismiss(id);
          }}
          className="shrink-0 rounded-xs px-1 text-sm font-bold text-accent underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        aria-label="Chiudi notifica"
        onClick={() => onDismiss(id)}
        className="-mr-1 shrink-0 rounded-full p-1 text-ink-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
      >
        <X aria-hidden="true" weight="bold" className="h-4 w-4" />
      </button>
    </li>
  );
}

/**
 * Renders two live regions (polite for info/success, assertive for errors)
 * that exist from first paint, so screen readers reliably announce updates.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastRecord[]>([]);
  const nextId = React.useRef(1);

  const dismiss = React.useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = React.useCallback((options: ToastOptions) => {
    const id = nextId.current++;
    setToasts((current) => [...current.slice(-3), { ...options, id }]);
    return id;
  }, []);

  const api = React.useMemo<ToastApi>(() => ({ notify, dismiss }), [notify, dismiss]);
  const polite = toasts.filter((toast) => toast.tone !== 'error');
  const assertive = toasts.filter((toast) => toast.tone === 'error');
  const regionClass = 'flex flex-col gap-2';

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-20 z-toast mx-auto flex max-w-sm flex-col gap-2 sm:left-auto sm:right-6 sm:mx-0">
        <ol role="status" aria-live="polite" aria-label="Notifiche" className={regionClass}>
          {polite.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </ol>
        <ol role="alert" aria-live="assertive" aria-label="Errori" className={regionClass}>
          {assertive.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </ol>
      </div>
    </ToastContext.Provider>
  );
}
