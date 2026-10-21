'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Page } from '@openmusic/shared';
import type { ResourceStatus } from './useApiResource';

export interface PagedList<T extends { id: string }> {
  items: T[];
  status: ResourceStatus;
  error: unknown;
  hasMore: boolean;
  loadingMore: boolean;
  /** Error of the last "load more" (the already loaded items stay visible). */
  moreError: unknown;
  loadMore: () => void;
  reload: () => void;
  setItems: React.Dispatch<React.SetStateAction<T[]>>;
}

/** Cursor pagination (`{ items, nextCursor }`) with the same `key` semantics as useApiResource. */
export function usePagedList<T extends { id: string }>(
  key: string | null,
  loadPage: (cursor: string | undefined) => Promise<Page<T>>
): PagedList<T> {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<ResourceStatus>('idle');
  const [error, setError] = useState<unknown>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<unknown>(null);
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(loadPage);
  loadRef.current = loadPage;
  const generation = useRef(0);

  useEffect(() => {
    const gen = ++generation.current;
    if (key === null) {
      setStatus('idle');
      return;
    }
    setStatus('loading');
    setError(null);
    setMoreError(null);
    loadRef
      .current(undefined)
      .then((page) => {
        if (gen !== generation.current) return;
        setItems(page.items);
        setCursor(page.nextCursor);
        setStatus('success');
      })
      .catch((err: unknown) => {
        if (gen !== generation.current) return;
        setError(err);
        setStatus('error');
      });
  }, [key, nonce]);

  const loadMore = useCallback(() => {
    if (!cursor || loadingMore) return;
    const gen = generation.current;
    setLoadingMore(true);
    setMoreError(null);
    loadRef
      .current(cursor)
      .then((page) => {
        if (gen !== generation.current) return;
        setItems((prev) => {
          // Items created locally meanwhile may come back in the next page: skip duplicates.
          const seen = new Set(prev.map((item) => item.id));
          return [...prev, ...page.items.filter((item) => !seen.has(item.id))];
        });
        setCursor(page.nextCursor);
      })
      .catch((err: unknown) => {
        if (gen === generation.current) setMoreError(err);
      })
      .finally(() => {
        if (gen === generation.current) setLoadingMore(false);
      });
  }, [cursor, loadingMore]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return {
    items,
    status,
    error,
    hasMore: cursor !== null,
    loadingMore,
    moreError,
    loadMore,
    reload,
    setItems,
  };
}
