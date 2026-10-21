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

/** Editorial page opener: catalogue eyebrow, Fraunces headline, italic deck. */
export function PageOpener({
  eyebrow,
  title,
  deck,
  icon,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  deck?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="space-y-3">
      <p className="om-eyebrow flex items-center gap-2 text-accent">
        {icon && (
          <span aria-hidden="true" className="inline-flex text-base">
            {icon}
          </span>
        )}
        {eyebrow}
      </p>
      <h1 className="om-headline text-display-sm text-ink sm:text-display-md">{title}</h1>
      {deck && <p className="om-deck max-w-2xl text-lg">{deck}</p>}
      {children}
    </header>
  );
}
