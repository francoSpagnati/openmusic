'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CatalogRelease, ReleasePage } from '@openmusic/shared';
import { api } from '../../lib/api';
import { BROWSE_PAGE_SIZE, type ExploreSort } from './params';

export interface BrowseState {
  status: 'loading' | 'ready' | 'error';
  items: CatalogRelease[];
  nextCursor: string | null;
  loadingMore: boolean;
  loadMoreFailed: boolean;
}

const isAbort = (err: unknown) => err instanceof DOMException && err.name === 'AbortError';

/**
 * Cursor-paginated releases for a genre/sort pair. Reuses the server-rendered first page when
 * the filters match it, and discards responses that arrive after the filters changed.
 */
export function useBrowseReleases(
  genre: string | null,
  sort: ExploreSort,
  initial: { page: ReleasePage | null; genre: string | null; sort: ExploreSort }
) {
  const initialUsable = initial.page !== null && initial.genre === genre && initial.sort === sort;
  const [state, setState] = useState<BrowseState>(() =>
    initial.page && initialUsable
      ? {
          status: 'ready',
          items: initial.page.items,
          nextCursor: initial.page.nextCursor,
          loadingMore: false,
          loadMoreFailed: false,
        }
      : {
          status: 'loading',
          items: [],
          nextCursor: null,
          loadingMore: false,
          loadMoreFailed: false,
        }
  );
  const [reloadToken, setReloadToken] = useState(0);
  const skipFirstFetch = useRef(initialUsable);
  const keyRef = useRef(`${genre}|${sort}`);
  keyRef.current = `${genre}|${sort}`;

  useEffect(() => {
    if (skipFirstFetch.current) {
      skipFirstFetch.current = false;
      return;
    }
    const controller = new AbortController();
    setState((s) => ({ ...s, status: 'loading', loadMoreFailed: false }));
    api.catalog
      .browse({ genre: genre ?? undefined, sort, limit: BROWSE_PAGE_SIZE })
      .then((page) => {
        if (controller.signal.aborted) return;
        setState({
          status: 'ready',
          items: page.items,
          nextCursor: page.nextCursor,
          loadingMore: false,
          loadMoreFailed: false,
        });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted || isAbort(err)) return;
        setState((s) => ({ ...s, status: 'error' }));
      });
    return () => controller.abort();
  }, [genre, sort, reloadToken]);

  const loadMore = useCallback(async () => {
    const cursor = state.nextCursor;
    if (!cursor || state.loadingMore) return;
    const key = keyRef.current;
    setState((s) => ({ ...s, loadingMore: true, loadMoreFailed: false }));
    try {
      const page = await api.catalog.browse({
        genre: genre ?? undefined,
        sort,
        cursor,
        limit: BROWSE_PAGE_SIZE,
      });
      if (keyRef.current !== key) return;
      setState((s) => ({
        ...s,
        items: [...s.items, ...page.items.filter((r) => !s.items.some((x) => x.id === r.id))],
        nextCursor: page.nextCursor,
        loadingMore: false,
      }));
    } catch {
      if (keyRef.current !== key) return;
      setState((s) => ({ ...s, loadingMore: false, loadMoreFailed: true }));
    }
  }, [genre, sort, state.nextCursor, state.loadingMore]);

  const retry = useCallback(() => setReloadToken((t) => t + 1), []);

  return { ...state, loadMore, retry };
}
