import { cache } from 'react';
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
