'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SearchResult } from '@openmusic/shared';
import { api } from '../../lib/api';

export type SearchState =
  | { status: 'idle' }
  | { status: 'loading'; previous: SearchResult | null }
  | { status: 'ready'; query: string; result: SearchResult }
  | { status: 'error' };

/** Catalog search for an already-debounced query. Empty queries reset to idle. */
export function useCatalogSearch(query: string): SearchState & { retry: () => void } {
  const [state, setState] = useState<SearchState>({ status: 'idle' });
  const [token, setToken] = useState(0);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setState({ status: 'idle' });
      return;
    }
    let cancelled = false;
    setState((s) => ({ status: 'loading', previous: s.status === 'ready' ? s.result : null }));
    api.catalog
      .search(q)
      .then((result) => {
        if (!cancelled) setState({ status: 'ready', query: q, result });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [query, token]);

  const retry = useCallback(() => setToken((t) => t + 1), []);
  return { ...state, retry };
}
