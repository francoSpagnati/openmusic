import React from 'react';
import { cn } from './cn';

export type BadgeTone = 'neutral' | 'accent' | 'fresh' | 'mixed' | 'rotten' | 'live';
export type BadgeVariant = 'soft' | 'outline' | 'solid';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Phosphor icon. Pair colour with an icon or text, never colour alone. */
  icon?: React.ReactNode;
  /** Monospace label, for catalogue numbers, genres-as-tags, counters. */
  mono?: boolean;
}

const tones: Record<BadgeTone, Record<BadgeVariant, string>> = {
  neutral: {
    soft: 'bg-ink/[0.07] text-ink-secondary',
    outline: 'border border-line-strong text-ink-secondary',
    solid: 'bg-ink text-canvas',
  },
  accent: {
    soft: 'bg-accent/[0.14] text-accent',
    outline: 'border border-accent/60 text-accent',
    solid: 'bg-accent text-on-accent',
  },
  fresh: {
    soft: 'bg-fresh/[0.14] text-fresh',
    outline: 'border border-fresh/60 text-fresh',
    solid: 'bg-fresh text-canvas',
  },
  mixed: {
    soft: 'bg-mixed/[0.14] text-mixed',
    outline: 'border border-mixed/60 text-mixed',
    solid: 'bg-mixed text-canvas',
  },
  rotten: {
    soft: 'bg-rotten/[0.14] text-rotten',
    outline: 'border border-rotten/60 text-rotten',
    solid: 'bg-rotten text-canvas',
  },
  live: {
    soft: 'bg-live/[0.14] text-live',
    outline: 'border border-live/60 text-live',
    solid: 'bg-live text-canvas',
  },
};

const sizes: Record<BadgeSize, string> = {
  sm: 'h-5 gap-1 px-1.5 text-[11px]',
  md: 'h-6 gap-1.5 px-2 text-xs',
};

export function Badge({
  tone = 'neutral',
  variant = 'soft',
  size = 'md',
  icon,
  mono = false,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-xs font-semibold leading-none',
        mono ? 'font-mono uppercase tracking-wider tabular-nums' : 'font-sans',
        tones[tone][variant],
        sizes[size],
        className
      )}
      {...rest}
    >
      {icon && (
        <span aria-hidden="true" className="inline-flex">
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}
