import React from 'react';
import { cn } from './cn';

export type SkeletonShape = 'text' | 'rect' | 'circle' | 'cover';

export interface SkeletonProps {
  shape?: SkeletonShape;
  /** Number of text lines (shape="text" only); the last one is shorter. */
  lines?: number;
  className?: string;
}

/* A calm 2s opacity breath on an ink wash; static under reduced motion. */
const shimmer = 'bg-fg/[0.07] animate-pulse-soft';

/**
 * Placeholder that mirrors the final layout to avoid shifts. Decorative only:
 * wrap the loading region in an element with aria-busy="true" and announce
 * the state once (e.g. a visually hidden "Caricamento…").
 */
export function Skeleton({ shape = 'rect', lines = 3, className }: SkeletonProps) {
  if (shape === 'text') {
    return (
      <span aria-hidden="true" className={cn('flex w-full flex-col gap-2', className)}>
        {Array.from({ length: lines }, (_, index) => (
          <span
            key={index}
            className={cn(
              'block h-3 rounded-xs',
              // Stagger the breath so lines do not pulse in lockstep.
              index % 2 === 1 && '[animation-delay:150ms]',
              shimmer,
              index === lines - 1 && lines > 1 ? 'w-3/5' : 'w-full'
            )}
          />
        ))}
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        'block',
        shimmer,
        shape === 'circle' && 'aspect-square rounded-full',
        shape === 'cover' && 'aspect-square w-full rounded-md',
        shape === 'rect' && 'h-24 w-full rounded-md',
        className
      )}
    />
  );
}
