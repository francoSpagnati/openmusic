import { useCallback, useEffect, useRef, useState } from 'react';

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface CursorListState<T> {
  items: T[];
  error: unknown;
  /** First page in flight and nothing to show yet. */
  loading: boolean;
  /** Pull-to-refresh in flight. */
  refreshing: boolean;
  loadingMore: boolean;
  /** Error of the last `loadMore` (the list keeps what it has). */
  loadMoreError: unknown;
  hasMore: boolean;
  reload: () => Promise<void>;
  loadMore: () => Promise<void>;
  /** Optimistic edits and socket pushes. */
  setItems: (updater: (prev: T[]) => T[]) => void;
}

/**
 * Cursor pagination over the API's `{ items, nextCursor }` pages (feed, notifications, a user's
 * posts). Refetches page 1 when `deps` change, ignores stale responses and dedupes by `id` when
 * appending, so a socket-inserted row is not shown twice.
 */
export function useCursorList<T extends { id: string }>(
  fetchPage: (cursor: string | undefined) => Promise<CursorPage<T>>,
  deps: ReadonlyArray<unknown>,
  options: { enabled?: boolean } = {}
): CursorListState<T> {
  const enabled = options.enabled ?? true;
  const [items, setItemsState] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loadMoreError, setLoadMoreError] = useState<unknown>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const generation = useRef(0);
  const moreInFlight = useRef(false);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const first = useCallback(async (mode: 'initial' | 'refresh') => {
    const id = ++generation.current;
    moreInFlight.current = false;
    setLoadingMore(false);
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    try {
      const page = await fetchRef.current(undefined);
      if (id !== generation.current) return;
      setItemsState(page.items);
      setCursor(page.nextCursor);
      setError(null);
      setLoadMoreError(null);
    } catch (err) {
      if (id !== generation.current) return;
      setError(err);
    } finally {
      if (id === generation.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    setItemsState([]);
    setCursor(null);
    void first('initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callers pass the fetcher's inputs as deps
  }, [enabled, first, ...deps]);

  const loadMore = useCallback(async () => {
    if (!cursor || moreInFlight.current) return;
    const id = generation.current;
    moreInFlight.current = true;
    setLoadingMore(true);
    try {
      const page = await fetchRef.current(cursor);
      if (id !== generation.current) return;
      setItemsState((prev) => {
        const seen = new Set(prev.map((x) => x.id));
        return [...prev, ...page.items.filter((x) => !seen.has(x.id))];
      });
      setCursor(page.nextCursor);
      setLoadMoreError(null);
    } catch (err) {
      if (id === generation.current) setLoadMoreError(err);
    } finally {
      if (id === generation.current) {
        moreInFlight.current = false;
        setLoadingMore(false);
      }
    }
  }, [cursor]);

  const reload = useCallback(() => first('refresh'), [first]);
  const setItems = useCallback((updater: (prev: T[]) => T[]) => setItemsState(updater), []);

  return {
    items,
    error,
    loading,
    refreshing,
    loadingMore,
    loadMoreError,
    hasMore: cursor !== null,
    reload,
    loadMore,
    setItems,
  };
}
