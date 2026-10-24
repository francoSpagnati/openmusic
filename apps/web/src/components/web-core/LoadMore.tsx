'use client';

import React, { useEffect, useRef } from 'react';
import { Button, ErrorState } from '@/components/ui';
import { errorMessage } from './format';

/**
 * "Load more" for cursor lists: loads automatically when the sentinel scrolls into view, and keeps
 * a real button for keyboard users and when IntersectionObserver is unavailable.
 */
export function LoadMore({
  hasMore,
  loading,
  error,
  onLoadMore,
  label = 'Carica altri',
  endLabel,
  auto = true,
}: {
  hasMore: boolean;
  loading: boolean;
  error: unknown;
  onLoadMore: () => void;
  label?: string;
  /** Shown once everything is loaded. */
  endLabel?: string;
  auto?: boolean;
}) {
  const sentinel = useRef<HTMLDivElement>(null);
  const onLoadRef = useRef(onLoadMore);
  onLoadRef.current = onLoadMore;

  useEffect(() => {
    const node = sentinel.current;
    if (!auto || !hasMore || error || !node || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadRef.current();
      },
      { rootMargin: '400px 0px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [auto, hasMore, error]);

  if (error) {
    return (
      <div className="p-4">
        <ErrorState
          variant="inline"
          title="Non siamo riusciti a caricare altro"
          description={errorMessage(error)}
          onRetry={onLoadMore}
          retrying={loading}
        />
      </div>
    );
  }

  if (!hasMore) {
    return endLabel ? (
      <p className="px-4 py-10 text-center text-sm text-fg-subtle">{endLabel}</p>
    ) : null;
  }

  return (
    <div ref={sentinel} className="flex justify-center px-4 py-8">
      <Button variant="ghost" onClick={onLoadMore} loading={loading} loadingLabel="Caricamento…">
        {label}
      </Button>
    </div>
  );
}
