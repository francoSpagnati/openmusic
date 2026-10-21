'use client';

import React, { useEffect, useState } from 'react';
import { absoluteTime, relativeTime } from './format';

/** Relative timestamp ("3 min fa") that refreshes every minute; full date on hover/AT. */
export function TimeAgo({ iso, className }: { iso: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // Until mounted, render the absolute date so server and client markup match.
  const label = now === null ? absoluteTime(iso) : relativeTime(iso, now);
  return (
    <time dateTime={iso} title={absoluteTime(iso)} className={className}>
      {label}
    </time>
  );
}
