'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CatalogSource, SearchResult } from '@openmusic/shared';
import { api } from '../../lib/api';

export const SEARCH_PAGE_SIZE = 12;

export interface SearchResults {
  query: string;
  result: SearchResult;
  /**
   * `local` = only the OpenMusic catalog so far (the external databases are still answering);
   * `complete` = local + Deezer/iTunes results for every loaded page.
   */
  phase: 'local' | 'complete';
  loadingMore: boolean;
  loadMoreFailed: boolean;
}

export type SearchState =
  | { status: 'idle' }
  | { status: 'loading'; previous: SearchResult | null }
  | ({ status: 'ready' } & SearchResults)
  | { status: 'error' };

/** Appends a page, keeping the first occurrence of every id (pages are independent server side). */
function mergePages(current: SearchResult, next: SearchResult): SearchResult {
  const releaseIds = new Set(current.releases.map((r) => r.id));
  const trackIds = new Set(current.tracks.map((t) => t.id));
  const sources = new Set<CatalogSource>([...current.sources, ...next.sources]);
  return {
    releases: [...current.releases, ...next.releases.filter((r) => !releaseIds.has(r.id))],
    tracks: [...current.tracks, ...next.tracks.filter((t) => !trackIds.has(t.id))],
    page: next.page,
    hasMore: next.hasMore,
    sources: Array.from(sources),
  };
}

/**
 * Catalog search for an already-debounced query. Empty queries reset to idle.
 *
 * Two requests run in parallel: the local catalog (`external=false`, answers in milliseconds)
 * and the full search, which also imports matches from Deezer/iTunes (up to a few seconds). The
 * local page is shown first and replaced when the full one arrives, so typing never feels stuck
 * on a slow upstream. Every id is an internal UUID either way, so results link straight to
 * `/releases/<id>`.
 */
export function useCatalogSearch(query: string): SearchState & {
  retry: () => void;
  loadMore: () => Promise<void>;
} {
  const [state, setState] = useState<SearchState>({ status: 'idle' });
  const [token, setToken] = useState(0);
  const queryRef = useRef(query);
  queryRef.current = query;

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    let completed = false;
    setState((s) => ({ status: 'loading', previous: s.status === 'ready' ? s.result : null }));

    const base = { q, page: 1, limit: SEARCH_PAGE_SIZE };
    const ready = (result: SearchResult, phase: SearchResults['phase']): SearchState => ({
      status: 'ready',
      query: q,
      result,
      phase,
      loadingMore: false,
      loadMoreFailed: false,
    });

    api.catalog
      .search({ ...base, external: 'false' })
      .then((result) => {
        if (!cancelled && !completed) setState(ready(result, 'local'));
      })
      .catch(() => {
        // The full search below decides between results and an error.
      });

    api.catalog
      .search(base)
      .then((result) => {
        completed = true;
        if (!cancelled) setState(ready(result, 'complete'));
      })
      .catch(() => {
        completed = true;
        if (cancelled) return;
        // Keep the local results if we have them: the external databases are a bonus.
        setState((s) =>
          s.status === 'ready' && s.result.releases.length + s.result.tracks.length > 0
            ? { ...s, phase: 'complete' }
            : { status: 'error' }
        );
      });

    return () => {
      cancelled = true;
    };
  }, [query, token]);

  const retry = useCallback(() => setToken((t) => t + 1), []);

  const loadMore = useCallback(async () => {
    if (state.status !== 'ready' || !state.result.hasMore || state.loadingMore) return;
    const { query: q, result } = state;
    setState((s) =>
      s.status === 'ready' ? { ...s, loadingMore: true, loadMoreFailed: false } : s
    );
    try {
      const next = await api.catalog.search({ q, page: result.page + 1, limit: SEARCH_PAGE_SIZE });
      if (queryRef.current.trim() !== q) return;
      setState((s) =>
        s.status === 'ready' && s.query === q
          ? { ...s, result: mergePages(s.result, next), loadingMore: false }
          : s
      );
    } catch {
      setState((s) =>
        s.status === 'ready' && s.query === q
          ? { ...s, loadingMore: false, loadMoreFailed: true }
          : s
      );
    }
  }, [state]);

  return { ...state, retry, loadMore };
}
