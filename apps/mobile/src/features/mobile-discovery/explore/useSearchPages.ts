import { useCallback, useEffect, useRef, useState } from 'react';
import type { CatalogRelease, CatalogSource, CatalogTrack, SearchResult } from '@openmusic/shared';
import { api } from '../../../lib/api';
import { mergeById } from '../catalog';

export type SearchKind = 'releases' | 'tracks';

export interface SearchPagesState {
  releases: CatalogRelease[];
  tracks: CatalogTrack[];
  /** Every database that contributed to the pages shown so far. */
  sources: CatalogSource[];
  loading: boolean;
  loadingMore: boolean;
  error: unknown;
  hasMore: boolean;
  loadMore: () => void;
  retry: () => void;
}

/** Results per page (the API caps `limit` at 25). */
export const SEARCH_PAGE_SIZE = 20;

type Search = (query: {
  q: string;
  type: SearchKind;
  page: number;
  limit: number;
}) => Promise<SearchResult>;

/**
 * Paged catalog search (`GET /api/catalog/search`): local catalog first, then results imported
 * live from Deezer / iTunes / MusicBrainz, every id already an internal UUID. Pages are merged by
 * id; a newer query always wins over a slower older one.
 */
export function useSearchPages(
  q: string,
  kind: SearchKind,
  search: Search = (query) => api.catalog.search(query)
): SearchPagesState {
  const [releases, setReleases] = useState<CatalogRelease[]>([]);
  const [tracks, setTracks] = useState<CatalogTrack[]>([]);
  const [sources, setSources] = useState<CatalogSource[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const requestId = useRef(0);
  const searchRef = useRef(search);
  searchRef.current = search;

  const fetchPage = useCallback(
    async (nextPage: number) => {
      const id = ++requestId.current;
      if (nextPage === 1) setLoading(true);
      else setLoadingMore(true);
      setError(null);
      try {
        const res = await searchRef.current({
          q,
          type: kind,
          page: nextPage,
          limit: SEARCH_PAGE_SIZE,
        });
        if (id !== requestId.current) return;
        setReleases((prev) => (nextPage === 1 ? res.releases : mergeById(prev, res.releases)));
        setTracks((prev) => (nextPage === 1 ? res.tracks : mergeById(prev, res.tracks)));
        setSources((prev) => {
          const all = nextPage === 1 ? res.sources : [...prev, ...res.sources];
          return Array.from(new Set(all));
        });
        setPage(res.page);
        setHasMore(res.hasMore);
      } catch (err) {
        if (id === requestId.current) setError(err);
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [q, kind]
  );

  useEffect(() => {
    if (q.length === 0) {
      requestId.current += 1;
      setReleases([]);
      setTracks([]);
      setSources([]);
      setPage(0);
      setHasMore(false);
      setLoading(false);
      setLoadingMore(false);
      setError(null);
      return;
    }
    setReleases([]);
    setTracks([]);
    void fetchPage(1);
  }, [q, fetchPage]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore || error) return;
    void fetchPage(page + 1);
  }, [loading, loadingMore, hasMore, error, page, fetchPage]);

  const retry = useCallback(() => {
    void fetchPage(page === 0 || releases.length + tracks.length === 0 ? 1 : page + 1);
  }, [fetchPage, page, releases.length, tracks.length]);

  return { releases, tracks, sources, loading, loadingMore, error, hasMore, loadMore, retry };
}
