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

/** A tiny spinning record: grooves, amber label, spindle hole. */
export function Spinner({ size = 'md', label = 'Caricamento…', className }: SpinnerProps) {
  const svg = (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      className={cn('om-spin-record shrink-0', sizes[size], className)}
    >
      <circle cx="12" cy="12" r="11" fill="currentColor" opacity="0.18" />
      <circle
        cx="12"
        cy="12"
        r="8.5"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="0.75"
      />
      <circle
        cx="12"
        cy="12"
        r="6.5"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="0.75"
      />
      <path
        d="M12 1a11 11 0 0 1 11 11"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="4" fill="rgb(var(--om-accent))" />
      <circle cx="12" cy="12" r="1" fill="rgb(var(--om-bg))" />
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
