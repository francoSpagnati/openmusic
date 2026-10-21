'use client';

import React, { useId } from 'react';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import { cn } from '@/components/ui';
import { useGhostMode } from './useGhostMode';

/** Accessible on/off switch for Ghost Mode (`role="switch"`), compact or with a description. */
export function GhostModeSwitch({
  variant = 'compact',
  className,
}: {
  variant?: 'compact' | 'detailed';
  className?: string;
}) {
  const { enabled, pending, set } = useGhostMode();
  const labelId = useId();
  const descId = useId();

  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        <span
          aria-hidden="true"
          className={cn('mt-0.5', enabled ? 'text-ink-muted' : 'text-fresh')}
        >
          {enabled ? <EyeSlash weight="bold" /> : <Eye weight="bold" />}
        </span>
        <div className="min-w-0">
          <p
            id={labelId}
            className={cn('font-semibold text-ink', variant === 'compact' ? 'text-xs' : 'text-sm')}
          >
            Ghost Mode
          </p>
          <p
            id={descId}
            className={cn('text-ink-muted', variant === 'compact' ? 'text-[11px]' : 'text-sm')}
          >
            {enabled ? 'I tuoi ascolti sono nascosti' : 'Gli amici vedono cosa ascolti'}
          </p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-labelledby={labelId}
        aria-describedby={descId}
        aria-busy={pending || undefined}
        disabled={pending}
        onClick={() => void set(!enabled)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-fast ease-standard',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
          'disabled:cursor-progress disabled:opacity-70',
          enabled ? 'border-accent bg-accent' : 'border-line-strong bg-sunken'
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            'inline-block h-4 w-4 rounded-full transition-transform duration-fast ease-tonearm',
            enabled ? 'translate-x-6 bg-on-accent' : 'translate-x-1 bg-ink-secondary'
          )}
        />
      </button>
    </div>
  );
}
