import React from 'react';
import Link from 'next/link';
import { cn } from '@/components/ui';

/** Logo: a small grooved record with the wordmark in Fraunces. */
export function BrandMark({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <Link
      href="/"
      aria-label="OpenMusic, vai alla home"
      className={cn(
        'group inline-flex items-center gap-3 rounded-md px-1 py-1',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'om-grooves block shrink-0 ring-1 ring-line transition-[box-shadow] duration-base group-hover:ring-accent/60',
          compact ? 'h-8 w-8' : 'h-10 w-10'
        )}
      />
      <span className="flex flex-col">
        <span className={cn('om-headline leading-none text-ink', compact ? 'text-xl' : 'text-2xl')}>
          OpenMusic
        </span>
        {!compact && <span className="om-eyebrow mt-1 text-[10px]">Dischi · amici · critica</span>}
      </span>
    </Link>
  );
}
