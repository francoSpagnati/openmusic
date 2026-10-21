import { useEffect, useState } from 'react';
import type { SearchResult } from '@openmusic/shared';
import { api } from '../../lib/api';

export interface CatalogSearchState {
  result: SearchResult | null;
  loading: boolean;
  error: unknown;
}

const DEBOUNCE_MS = 350;

/**
 * Debounced `GET /api/catalog/search` for the track/release pickers. Results include rows the
 * API imported from external databases (Deezer / iTunes / MusicBrainz), already with internal
 * UUIDs, so a picked id can go straight into `trackId` / `releaseId`.
 */
export function useCatalogSearch(
  query: string,
  type: 'all' | 'tracks' | 'releases'
): CatalogSearchState {
  const [state, setState] = useState<CatalogSearchState>({
    result: null,
    loading: false,
    error: null,
  });
  const q = query.trim();

  useEffect(() => {
    if (q.length < 2) {
      setState({ result: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    const timer = setTimeout(() => {
      api.catalog
        .search({ q, type, limit: 10 })
        .then((result) => {
          if (!cancelled) setState({ result, loading: false, error: null });
        })
        .catch((error: unknown) => {
          if (!cancelled) setState({ result: null, loading: false, error });
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, type]);

  return state;
}
