import { useCallback, useEffect, useRef, useState } from 'react';

export interface ApiQueryState<T> {
  data: T | undefined;
  error: unknown;
  /** First load (no data yet). */
  loading: boolean;
  /** Pull-to-refresh / retry while data is already shown. */
  refreshing: boolean;
  reload: () => Promise<void>;
  /** Replace the cached data (optimistic updates, socket pushes). */
  setData: (updater: (prev: T | undefined) => T | undefined) => void;
}

/**
 * Minimal data-fetching hook for screens: runs `fetcher` on mount and whenever `deps` change,
 * ignores stale responses, and exposes `reload` for pull-to-refresh and the ErrorState retry.
 * Pass `enabled: false` to wait (e.g. until a route param is known).
 */
export function useApiQuery<T>(
  fetcher: () => Promise<T>,
  deps: ReadonlyArray<unknown>,
  options: { enabled?: boolean } = {}
): ApiQueryState<T> {
  const enabled = options.enabled ?? true;
  const [data, setDataState] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async (mode: 'initial' | 'refresh') => {
    const id = ++requestId.current;
    if (mode === 'initial') setLoading(true);
    else setRefreshing(true);
    try {
      const result = await fetcherRef.current();
      if (id !== requestId.current) return;
      setDataState(result);
      setError(null);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err);
    } finally {
      if (id === requestId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void run('initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callers pass the fetcher's inputs as deps
  }, [enabled, run, ...deps]);

  const reload = useCallback(() => run('refresh'), [run]);
  const setData = useCallback(
    (updater: (prev: T | undefined) => T | undefined) => setDataState(updater),
    []
  );

  return { data, error, loading, refreshing, reload, setData };
}
