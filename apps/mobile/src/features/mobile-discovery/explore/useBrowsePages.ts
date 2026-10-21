import { useCallback, useEffect, useRef, useState } from 'react';
import type { BrowseReleasesQuery, CatalogRelease, ReleasePage } from '@openmusic/shared';
import { api } from '../../../lib/api';
import { mergeById } from '../catalog';

export interface BrowsePagesState {
  items: CatalogRelease[];
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: unknown;
  hasMore: boolean;
  loadMore: () => void;
  reload: () => void;
}

type Browse = (query: BrowseReleasesQuery) => Promise<ReleasePage>;

/** Popular releases (optionally of one genre) with cursor pagination, for Esplora's default view. */
export function useBrowsePages(
  genre: string | null,
  enabled: boolean,
  browse: Browse = (q) => api.catalog.browse(q)
): BrowsePagesState {
  const [items, setItems] = useState<CatalogRelease[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const requestId = useRef(0);
  const browseRef = useRef(browse);
  browseRef.current = browse;

  const fetchPage = useCallback(
    async (mode: 'initial' | 'refresh' | 'more', after: string | null) => {
      const id = ++requestId.current;
      if (mode === 'initial') setLoading(true);
      else if (mode === 'refresh') setRefreshing(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const page = await browseRef.current({
          sort: 'popular',
          limit: 20,
          ...(genre ? { genre } : {}),
          ...(after ? { cursor: after } : {}),
        });
        if (id !== requestId.current) return;
        setItems((prev) => (mode === 'more' ? mergeById(prev, page.items) : page.items));
        setCursor(page.nextCursor);
      } catch (err) {
        if (id === requestId.current) setError(err);
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [genre]
  );

  useEffect(() => {
    if (!enabled) return;
    setItems([]);
    setCursor(null);
    void fetchPage('initial', null);
  }, [enabled, fetchPage]);

  const loadMore = useCallback(() => {
    if (!cursor || loading || loadingMore || refreshing || error) return;
    void fetchPage('more', cursor);
  }, [cursor, loading, loadingMore, refreshing, error, fetchPage]);

  const reload = useCallback(() => {
    void fetchPage(items.length > 0 ? 'refresh' : 'initial', null);
  }, [fetchPage, items.length]);

  return {
    items,
    loading,
    refreshing,
    loadingMore,
    error,
    hasMore: cursor !== null,
    loadMore,
    reload,
  };
}
