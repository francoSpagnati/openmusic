'use client';

import React from 'react';
import { ArrowClockwise, SmileySad } from '@phosphor-icons/react';
import { cn } from './cn';
import { Button } from './Button';

export interface ErrorStateProps {
  /** Human, calm, specific: "Non riusciamo a caricare le uscite". Never an HTTP code. */
  title?: React.ReactNode;
  description?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  retrying?: boolean;
  /** Extra recovery action, e.g. "Riconnetti Spotify". */
  action?: React.ReactNode;
  /** `inline` renders a slim banner for use inside lists/cards. */
  variant?: 'block' | 'inline';
  className?: string;
}

export function ErrorState({
  title = 'Qualcosa si è inceppato',
  description = 'La puntina è saltata. Riprova tra un attimo.',
  onRetry,
  retryLabel = 'Riprova',
  retrying = false,
  action,
  variant = 'block',
  className,
}: ErrorStateProps) {
  const actions = (onRetry || action) && (
    <div className="flex flex-wrap items-center gap-2">
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          loading={retrying}
          onClick={onRetry}
          leadingIcon={<ArrowClockwise weight="bold" />}
        >
          {retryLabel}
        </Button>
      )}
      {action}
    </div>
  );

  if (variant === 'inline') {
    return (
      <div
        role="alert"
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 rounded-md border border-rotten/40 bg-rotten/[0.08] px-4 py-3',
          className
        )}
      >
        <div className="flex min-w-0 items-start gap-2">
          <SmileySad
            aria-hidden="true"
            weight="duotone"
            className="mt-0.5 h-5 w-5 shrink-0 text-rotten"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">{title}</p>
            {description && <p className="text-sm text-ink-secondary">{description}</p>}
          </div>
        </div>
        {actions}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border border-line px-6 py-12 text-center',
        className
      )}
    >
      <SmileySad aria-hidden="true" weight="duotone" className="h-10 w-10 text-rotten" />
      <h3 className="om-headline text-2xl text-ink">{title}</h3>
      {description && <p className="max-w-prose text-sm text-ink-secondary">{description}</p>}
      {actions && <div className="mt-1">{actions}</div>}
    </div>
  );
}
