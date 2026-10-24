'use client';

import React, { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowsClockwise } from '@phosphor-icons/react';
import { Button, Spinner } from '../../../components/ui';

/** How long to wait before re-rendering once on our own: the background sync is one request. */
const AUTO_REFRESH_MS = 8_000;

/**
 * Shown while the API fetches more editions from MusicBrainz in the background. Re-renders the
 * page once by itself after a few seconds, and offers a manual reload.
 */
export function EditionsSyncNotice() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [autoRefreshed, setAutoRefreshed] = useState(false);

  useEffect(() => {
    if (autoRefreshed) return;
    const id = window.setTimeout(() => {
      setAutoRefreshed(true);
      startTransition(() => router.refresh());
    }, AUTO_REFRESH_MS);
    return () => window.clearTimeout(id);
  }, [autoRefreshed, router]);

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-3 border-y border-line py-2 text-sm text-fg-muted"
    >
      <Spinner size="sm" label={null} />
      <span className="min-w-0 flex-1">
        Sto cercando altre edizioni su MusicBrainz: compariranno qui tra poco.
      </span>
      <Button
        variant="ghost"
        size="sm"
        loading={pending}
        loadingLabel="Aggiorno…"
        leadingIcon={<ArrowsClockwise weight="bold" />}
        onClick={() => startTransition(() => router.refresh())}
      >
        Aggiorna
      </Button>
    </div>
  );
}
