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
        'flex flex-col items-center rounded-xl border border-dashed border-line-strong/60 text-center',
        compact ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-14',
        className
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className={cn('text-fg-subtle', compact ? 'text-2xl' : 'text-3xl')}
        >
          {icon}
        </span>
      ) : (
        <span
          aria-hidden="true"
          className={cn('om-grooves block', compact ? 'h-10 w-10' : 'h-14 w-14')}
        />
      )}
      <h3 className={cn('om-headline text-fg', compact ? 'text-lg' : 'text-2xl')}>{title}</h3>
      {description && <p className="max-w-narrow text-sm text-fg-muted">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
