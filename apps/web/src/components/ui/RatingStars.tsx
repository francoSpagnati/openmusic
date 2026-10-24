'use client';

import React from 'react';
import { Star, StarHalf } from '@phosphor-icons/react';
import { cn } from './cn';

export type RatingSize = 'sm' | 'md' | 'lg';

/** ADR-001: ratings are stored as integers 10..100 (3.5 stars = 70). */
export function starsFromRating(rating: number): number {
  return Math.round(rating / 10) / 2;
}

export function ratingFromStars(stars: number): number {
  return Math.round(stars * 20);
}

const MIN = 0.5;
const MAX = 5;
const STEP = 0.5;

const clamp = (value: number) => Math.min(MAX, Math.max(MIN, Math.round(value / STEP) * STEP));

const sizes: Record<RatingSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-9 w-9',
};

export interface RatingStarsProps {
  /** Stars, 0.5..5 in 0.5 steps. `null`/0 = not rated yet. */
  value: number | null;
  /** Omit for a read-only display. */
  onChange?: (stars: number) => void;
  size?: RatingSize;
  /** Accessible name, e.g. "Il tuo voto per OK Computer". */
  label?: string;
  /** Show the numeric value next to the stars (mono, tabular). */
  showValue?: boolean;
  disabled?: boolean;
  className?: string;
}

function formatStars(value: number): string {
  return value.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function StarGlyph({ fill, className }: { fill: 0 | 0.5 | 1; className: string }) {
  if (fill === 1) return <Star weight="fill" className={cn(className, 'text-accent')} />;
  if (fill === 0.5) {
    return (
      <span className="relative inline-flex">
        <Star weight="regular" className={cn(className, 'text-line-strong')} />
        <StarHalf weight="fill" className={cn(className, 'absolute inset-0 text-accent')} />
      </span>
    );
  }
  return <Star weight="regular" className={cn(className, 'text-line-strong')} />;
}

/**
 * Half-star rating. Interactive mode is a single `role="slider"`:
 * Arrow keys ±0.5, PageUp/PageDown ±1, Home/End min/max. Pointer: the
 * left half of a star sets x.5, the right half sets x.0, with hover preview.
 */
export function RatingStars({
  value,
  onChange,
  size = 'md',
  label = 'Voto',
  showValue = false,
  disabled = false,
  className,
}: RatingStarsProps) {
  const [hover, setHover] = React.useState<number | null>(null);
  const interactive = Boolean(onChange) && !disabled;
  const current = value && value > 0 ? value : 0;
  const shown = hover ?? current;
  const valueText = current > 0 ? `${formatStars(current)} stelle su 5` : 'Nessun voto';

  const commit = (next: number) => {
    if (!onChange || disabled) return;
    onChange(clamp(next));
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const base = current || 0;
    const keys: Record<string, number> = {
      ArrowRight: base + STEP,
      ArrowUp: base + STEP,
      ArrowLeft: base - STEP,
      ArrowDown: base - STEP,
      PageUp: base + 1,
      PageDown: base - 1,
      Home: MIN,
      End: MAX,
    };
    const next = keys[event.key];
    if (next === undefined) return;
    event.preventDefault();
    commit(next);
  };

  const starFromPointer = (
    event: React.PointerEvent<HTMLSpanElement> | React.MouseEvent<HTMLSpanElement>,
    index: number
  ) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const isLeftHalf = event.clientX - rect.left < rect.width / 2;
    return index + (isLeftHalf ? 0.5 : 1);
  };

  const stars = Array.from({ length: 5 }, (_, index) => {
    const fill: 0 | 0.5 | 1 = shown >= index + 1 ? 1 : shown >= index + 0.5 ? 0.5 : 0;
    return (
      <span
        key={index}
        className={cn(
          'inline-flex',
          interactive &&
            'cursor-pointer transition-transform duration-fast ease-out hover:scale-105'
        )}
        onPointerMove={interactive ? (event) => setHover(starFromPointer(event, index)) : undefined}
        onClick={interactive ? (event) => commit(starFromPointer(event, index)) : undefined}
      >
        <StarGlyph fill={fill} className={sizes[size]} />
      </span>
    );
  });

  const numeric = showValue && (
    <span className="ml-2 font-mono text-sm font-medium tabular-nums text-fg" aria-hidden="true">
      {current > 0 ? formatStars(current) : '–'}
    </span>
  );

  if (!interactive) {
    return (
      <span
        role="img"
        aria-label={`${label}: ${valueText}`}
        className={cn('inline-flex items-center', className)}
      >
        <span aria-hidden="true" className="inline-flex gap-0.5">
          {stars}
        </span>
        {numeric}
      </span>
    );
  }

  return (
    <div className={cn('inline-flex items-center', className)}>
      <div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        aria-valuenow={current || undefined}
        aria-valuetext={valueText}
        onKeyDown={onKeyDown}
        onPointerLeave={() => setHover(null)}
        className="inline-flex touch-manipulation gap-0.5 rounded-sm p-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {stars}
      </div>
      {numeric}
    </div>
  );
}
