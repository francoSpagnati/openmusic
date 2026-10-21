import React from 'react';
import { cn } from './cn';

export type CardVariant = 'surface' | 'sleeve' | 'outline' | 'sunken';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  /** `sleeve` is the signature record-sleeve look (ring wear + open edge). */
  variant?: CardVariant;
  padding?: CardPadding;
  /** Adds hover lift. Put the real link/button inside; the card itself is not focusable. */
  interactive?: boolean;
  as?: 'div' | 'article' | 'section' | 'li' | 'aside';
}

const variants: Record<CardVariant, string> = {
  surface: 'rounded-lg border border-line bg-surface shadow-om-sm',
  sleeve: 'om-sleeve',
  outline: 'rounded-lg border border-line',
  sunken: 'rounded-lg bg-sunken',
};

const paddings: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-6 sm:p-8',
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
          'transition-[border-color,translate,box-shadow] duration-base ease-standard hover:-translate-y-0.5 hover:border-line-strong hover:shadow-om-md focus-within:border-line-strong',
        className
      )}
      {...rest}
    >
      {children}
    </Component>
  );
}

export interface CardHeaderProps {
  /** Small mono catalogue label above the title, e.g. "LATO A · 1997". */
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
    <div className={cn('mb-3 flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        {eyebrow && <p className="om-eyebrow mb-1">{eyebrow}</p>}
        <Heading className="om-headline truncate text-xl text-ink">{title}</Heading>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
