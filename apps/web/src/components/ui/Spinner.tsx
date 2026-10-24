import React from 'react';
import { cn } from './cn';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize;
  /** Accessible label. Pass `null` when the spinner is decorative (e.g. inside a busy Button). */
  label?: string | null;
  className?: string;
}

const sizes: Record<SpinnerSize, string> = {
  xs: 'h-3.5 w-3.5',
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-10 w-10',
};

/**
 * A thin ring with a quarter arc, in `currentColor`. It turns at an unhurried 0.9s; under
 * reduced motion it stands still (the label still announces the busy state).
 */
export function Spinner({ size = 'md', label = 'Caricamento…', className }: SpinnerProps) {
  const svg = (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={cn(
        'shrink-0 animate-[spin_0.9s_linear_infinite] motion-reduce:animate-none',
        sizes[size],
        className
      )}
    >
      <circle
        cx="12"
        cy="12"
        r="9.5"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.2"
        strokeWidth="2"
      />
      <path
        d="M12 2.5a9.5 9.5 0 0 1 9.5 9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );

  if (label === null) return svg;

  return (
    <span role="status" className="inline-flex items-center">
      {svg}
      <span className="sr-only">{label}</span>
    </span>
  );
}
