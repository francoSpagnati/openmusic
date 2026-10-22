import { cache } from 'react';
import type { ReleaseGroupDetail } from '@openmusic/shared';
import { api, isApiError } from '../../../lib/api';

/**
 * One release group per request, shared by `generateMetadata` and the page (React `cache`).
 * Null when the id is unknown or malformed (the API answers 404 / 400): the page shows 404.
 */
export const getReleaseGroup = cache(async (id: string): Promise<ReleaseGroupDetail | null> => {
  try {
    return await api.catalog.releaseGroup(id);
  } catch (err) {
    if (isApiError(err) && (err.status === 404 || err.status === 400)) return null;
    throw err;
  }
});
