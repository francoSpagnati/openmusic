import React from 'react';
import { cn } from './cn';

export type CardVariant = 'surface' | 'raised' | 'sleeve' | 'outline' | 'sunken';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * `surface` stone card (default), `raised` paper card for floating/featured content,
   * `outline` hairline only, `sunken` recessed well. `sleeve` is kept as an alias of the
   * music-object card (same hairline look, slightly larger corner).
   */
  variant?: CardVariant;
  padding?: CardPadding;
  /** Hover/focus-within strengthens the hairline. Put the real link/button inside. */
  interactive?: boolean;
  as?: 'div' | 'article' | 'section' | 'li' | 'aside';
}

const variants: Record<CardVariant, string> = {
  surface: 'rounded-lg border border-line bg-surface',
  raised: 'rounded-lg border border-line bg-surface-raised',
  sleeve: 'om-sleeve',
  outline: 'rounded-lg border border-line',
  sunken: 'rounded-lg bg-sunken',
};

const paddings: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-6',
  lg: 'p-6 sm:p-10',
};

export function Card({
  variant = 'surface',
  padding = 'md',
  interactive = false,
  as: Component = 'div',
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <Component
      className={cn(
        variants[variant],
        paddings[padding],
        interactive &&
          'transition-[border-color,background-color] duration-base ease-out hover:border-line-strong focus-within:border-line-strong',
        className
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}

export interface CardHeaderProps {
  /** Small sentence-case context line above the title, e.g. "Album del 1997". */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  /** Heading level for document outline; visual size is fixed. */
  level?: 2 | 3 | 4;
  action?: React.ReactNode;
  className?: string;
}

export function CardHeader({ eyebrow, title, level = 3, action, className }: CardHeaderProps) {
  const Heading = `h${level}` as const;
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="om-eyebrow mb-0.5">{eyebrow}</p>}
        <Heading className="om-headline truncate text-xl text-fg">{title}</Heading>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
