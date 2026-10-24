import React from 'react';
import { cn } from './cn';

/** `mixed` renders with the `warning` token; `live` with `fresh`. */
export type BadgeTone = 'neutral' | 'accent' | 'fresh' | 'mixed' | 'rotten' | 'live';
export type BadgeVariant = 'soft' | 'outline' | 'solid';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Phosphor icon. Pair colour with an icon or text, never colour alone. */
  icon?: React.ReactNode;
  /** Monospace label, for catalogue numbers and counters (no forced caps). */
  mono?: boolean;
}

/* Soft tints stay at 8% so the tinted text keeps >= 4.5:1 (scripts/check-contrast.ts). */
const tones: Record<BadgeTone, Record<BadgeVariant, string>> = {
  neutral: {
    soft: 'bg-fg/[0.06] text-fg-muted',
    outline: 'border border-line-strong text-fg-muted',
    solid: 'bg-fg text-canvas',
  },
  accent: {
    soft: 'bg-accent/[0.08] text-accent',
    outline: 'border border-accent/50 text-accent',
    solid: 'bg-accent text-accent-contrast',
  },
  fresh: {
    soft: 'bg-fresh/[0.08] text-fresh',
    outline: 'border border-fresh/50 text-fresh',
    solid: 'bg-fresh text-canvas',
  },
  mixed: {
    soft: 'bg-warning/[0.08] text-warning',
    outline: 'border border-warning/50 text-warning',
    solid: 'bg-warning text-canvas',
  },
  rotten: {
    soft: 'bg-rotten/[0.08] text-rotten',
    outline: 'border border-rotten/50 text-rotten',
    solid: 'bg-rotten text-canvas',
  },
  live: {
    soft: 'bg-fresh/[0.08] text-fresh',
    outline: 'border border-fresh/50 text-fresh',
    solid: 'bg-fresh text-canvas',
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
        'inline-flex shrink-0 items-center whitespace-nowrap rounded-sm font-medium leading-none',
        mono ? 'font-mono tabular-nums' : 'font-sans',
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
