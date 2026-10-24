import React from 'react';
import { Sidebar } from '../Sidebar';
import { cn } from '../ui';

/** Page frame for discovery pages: navigation rail + one wide content column. */
export function DiscoveryShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-7xl justify-center">
      <Sidebar />
      <div
        className={cn(
          'min-w-0 flex-1 px-4 py-6 sm:px-6 lg:border-r lg:border-line lg:px-8 lg:py-8',
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Editorial page opener: an optional quiet context line, the Newsreader headline and an italic
 * deck. No icon, no accent: the sidebar already says where you are.
 */
export function PageOpener({
  eyebrow,
  title,
  deck,
  children,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  deck?: React.ReactNode;
  /** @deprecated Ignored since ADR-015 (openers carry no icon). */
  icon?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="om-enter max-w-3xl space-y-3 pt-2">
      {eyebrow && <p className="om-eyebrow">{eyebrow}</p>}
      <h1 className="om-headline text-balance text-display-md text-fg lg:text-display-lg">
        {title}
      </h1>
      {deck && <p className="om-deck max-w-prose text-lg sm:text-xl">{deck}</p>}
      {children}
    </header>
  );
}
