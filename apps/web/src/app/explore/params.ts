export type ExploreSort = 'popular' | 'recent';

export interface ExploreParams {
  q: string;
  genre: string | null;
  sort: ExploreSort;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

export const BROWSE_PAGE_SIZE = 12;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Normalises `?q=&genre=&sort=` (server and client share this). */
export function parseExploreParams(raw: RawSearchParams): ExploreParams {
  const genre = first(raw.genre)?.trim().slice(0, 40);
  return {
    q: (first(raw.q) ?? '').slice(0, 100),
    genre: genre ? genre : null,
    sort: first(raw.sort) === 'recent' ? 'recent' : 'popular',
  };
}

/** Query string for the current state, omitting defaults so URLs stay short and shareable. */
export function exploreQueryString(params: ExploreParams): string {
  const search = new URLSearchParams();
  if (params.q.trim()) search.set('q', params.q.trim());
  if (params.genre) search.set('genre', params.genre);
  if (params.sort !== 'popular') search.set('sort', params.sort);
  const text = search.toString();
  return text ? `?${text}` : '';
}
