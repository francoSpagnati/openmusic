import React from 'react';
import { cn } from './cn';

export interface EmptyStateProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Phosphor icon; defaults to a vinyl-groove disc. */
  icon?: React.ReactNode;
  /** Primary next step, e.g. a Button or Link styled with buttonClasses(). */
  action?: React.ReactNode;
  /** Use `compact` inside cards and sidebars. */
  size?: 'compact' | 'default';
  className?: string;
}

/** "Empty crate": tells the user what's missing and what to do next. */
export function EmptyState({
  title,
  description,
  icon,
  action,
  size = 'default',
  className,
}: EmptyStateProps) {
  const compact = size === 'compact';
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-lg border border-dashed border-line text-center',
        compact ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-12',
        className
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className={cn('text-ink-muted', compact ? 'text-2xl' : 'text-4xl')}
        >
          {icon}
        </span>
      ) : (
        <span
          aria-hidden="true"
          className={cn('om-grooves block', compact ? 'h-10 w-10' : 'h-16 w-16')}
        />
      )}
      <h3 className={cn('om-headline text-ink', compact ? 'text-lg' : 'text-2xl')}>{title}</h3>
      {description && <p className="max-w-prose text-sm text-ink-secondary">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
