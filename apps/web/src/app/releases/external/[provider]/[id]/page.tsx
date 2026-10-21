import { notFound, redirect } from 'next/navigation';
import { CatalogProviderSchema, CatalogResolveQuerySchema } from '@openmusic/shared';
import { api, isApiError } from '../../../../../lib/api';

interface Props {
  params: { provider: string; id: string };
  searchParams: Record<string, string | string[] | undefined>;
}

// Imports on first use: never cache.
export const dynamic = 'force-dynamic';

/**
 * Stable link to an album (or track, `?type=track`) by its id in an external database, e.g.
 * `/releases/external/deezer/302127` or `/releases/external/musicbrainz/<mbid>`. The API imports
 * it on first use; we redirect to the internal `/releases/<uuid>` page (`#track-<uuid>` for a
 * track). Also the target of legacy `deezer-alb-N` / `deezer-trk-N` ids.
 */
export default async function ExternalReleasePage({ params, searchParams }: Props) {
  const provider = CatalogProviderSchema.safeParse(params.provider);
  const type = searchParams.type === 'track' ? 'track' : 'release';
  const query = CatalogResolveQuerySchema.safeParse({
    provider: provider.success ? provider.data : undefined,
    type,
    id: decodeURIComponent(params.id),
  });
  if (!query.success) notFound();

  let target: string;
  try {
    const { release, trackId } = await api.catalog.resolve(query.data);
    target = `/releases/${release.id}${trackId ? `#track-${trackId}` : ''}`;
  } catch (err) {
    // 400 = malformed id, 404 = the provider does not know it. 502 (provider unreachable) and
    // anything else reach the error boundary, which offers a retry.
    if (isApiError(err) && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }
  redirect(target);
}
