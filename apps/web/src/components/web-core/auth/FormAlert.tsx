import React from 'react';
import { WarningCircle } from '@phosphor-icons/react';

/** Form-level error banner, announced as soon as it appears. */
export function FormAlert({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-md border border-rotten/50 bg-rotten/[0.08] px-3.5 py-3 text-sm text-fg"
    >
      <WarningCircle
        aria-hidden="true"
        weight="fill"
        className="mt-0.5 h-4 w-4 shrink-0 text-rotten"
      />
      <div>{children}</div>
    </div>
  );
}
