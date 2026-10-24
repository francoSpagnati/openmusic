import React from 'react';
import Link from 'next/link';
import { cn } from '@/components/ui';

/** Logo: a small grooved record with the wordmark in Newsreader. */
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
        'group inline-flex items-center gap-2.5 rounded-md px-1 py-1',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'om-grooves block shrink-0 ring-1 ring-line transition-[box-shadow] duration-base group-hover:ring-accent/50',
          compact ? 'h-7 w-7' : 'h-8 w-8'
        )}
      />
      <span className="flex flex-col">
        <span
          className={cn('om-headline leading-none text-fg', compact ? 'text-xl' : 'text-[1.4rem]')}
        >
          OpenMusic
        </span>
        {!compact && (
          <span className="mt-1 text-xs leading-none text-fg-subtle">Dischi, amici e critica</span>
        )}
      </span>
    </Link>
  );
}
