import { cache } from 'react';
import { redirect } from 'next/navigation';
import type { CatalogRelease } from '@openmusic/shared';
import { api, isApiError } from '../../../lib/api';

/**
 * One release per request, shared by `generateMetadata` and the page (React `cache`).
 * Null when the id is unknown or malformed (the API answers 404 / 400): the page shows 404.
 */
export const getRelease = cache(async (id: string): Promise<CatalogRelease | null> => {
  try {
    return await api.catalog.release(id);
  } catch (err) {
    if (isApiError(err) && (err.status === 404 || err.status === 400)) return null;
    throw err;
  }
});

/** Settled value or a fallback, so one failing side panel never takes the page down. */
export function settled<T, F>(result: PromiseSettledResult<T>, fallback: F): T | F {
  return result.status === 'fulfilled' ? result.value : fallback;
}

/**
 * Old catalog search ids (`deezer-alb-302127`, `deezer-trk-3135556`) are no longer valid release
 * ids: send them through the external resolver, which imports the album and redirects to its
 * internal UUID. No-op for any other id.
 */
export function redirectLegacyId(id: string): void {
  const legacy = /^deezer-(alb|trk)-(\d{1,20})$/.exec(id);
  if (!legacy) return;
  redirect(`/releases/external/deezer/${legacy[2]}${legacy[1] === 'trk' ? '?type=track' : ''}`);
}
