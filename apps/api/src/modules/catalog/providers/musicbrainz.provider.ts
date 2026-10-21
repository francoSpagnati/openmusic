import { z } from 'zod';
import { normalizeIsrc } from '@openmusic/shared';
import type { UpstreamClient } from '../../../lib/upstream';
import { genreLabel, isoDateOrNull, lucenePhrase, releaseTypeFrom } from './shared';
import type { ProviderArtist, ProviderRelease, ProviderTrack } from './types';

/**
 * MusicBrainz web service v2 (https://musicbrainz.org/doc/MusicBrainz_API). Rules we must follow:
 * a meaningful User-Agent `App/version ( contact )` on every request, and at most one request per
 * second per IP (503 otherwise) — the UpstreamClient for this provider is configured for both.
 */
export const MUSICBRAINZ_API = 'https://musicbrainz.org/ws/2';

const MBID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isMbid(value: string): boolean {
  return MBID.test(value);
}

const ArtistCreditSchema = z.array(
  z.object({
    name: z.string(),
    joinphrase: z.string().nullish(),
    artist: z.object({ id: z.string(), name: z.string() }),
  })
);

const TagSchema = z.object({ name: z.string(), count: z.number().nullish() });

const ReleaseGroupRefSchema = z.object({
  id: z.string(),
  title: z.string().nullish(),
  'primary-type': z.string().nullish(),
  genres: z.array(TagSchema).nullish(),
  tags: z.array(TagSchema).nullish(),
});

const LabelInfoSchema = z.array(
  z.object({
    'catalog-number': z.string().nullish(),
    label: z.object({ id: z.string(), name: z.string() }).nullish(),
  })
);

const SearchReleaseSchema = z.object({
  id: z.string(),
  score: z.coerce.number().nullish(),
  title: z.string(),
  date: z.string().nullish(),
  barcode: z.string().nullish(),
  'artist-credit': ArtistCreditSchema.nullish(),
  'release-group': ReleaseGroupRefSchema.nullish(),
  'label-info': LabelInfoSchema.nullish(),
});

const ReleaseSearchSchema = z.object({
  count: z.number().nullish(),
  releases: z.array(SearchReleaseSchema),
});

const ReleaseLookupSchema = SearchReleaseSchema.extend({
  genres: z.array(TagSchema).nullish(),
  tags: z.array(TagSchema).nullish(),
  'cover-art-archive': z.object({ front: z.boolean().nullish() }).nullish(),
  media: z
    .array(
      z.object({
        position: z.number().nullish(),
        tracks: z
          .array(
            z.object({
              id: z.string(),
              position: z.number().nullish(),
              title: z.string(),
              length: z.number().nullish(),
              recording: z.object({
                id: z.string(),
                title: z.string(),
                length: z.number().nullish(),
                isrcs: z.array(z.string()).nullish(),
              }),
            })
          )
          .nullish(),
      })
    )
    .nullish(),
});

const ReleaseGroupLookupSchema = ReleaseGroupRefSchema;

const IsrcLookupSchema = z.object({
  isrc: z.string(),
  recordings: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      releases: z
        .array(z.object({ id: z.string(), title: z.string(), date: z.string().nullish() }))
        .nullish(),
    })
  ),
});

export interface MusicBrainzReleaseHit {
  mbid: string;
  score: number;
  title: string;
  artistName: string;
  barcode: string | null;
  date: string | null;
  releaseGroupId: string | null;
}

export interface MusicBrainzRelease extends ProviderRelease {
  hasFrontCover: boolean;
}

function creditName(credit: z.infer<typeof ArtistCreditSchema> | null | undefined): string {
  if (!credit || credit.length === 0) return 'Unknown Artist';
  return credit
    .map((c) => `${c.name}${c.joinphrase ?? ''}`)
    .join('')
    .trim();
}

/** Genres first (curated), then the most voted folksonomy tags; max 4, title-cased. */
export function topGenres(
  genres: Array<z.infer<typeof TagSchema>> | null | undefined,
  tags: Array<z.infer<typeof TagSchema>> | null | undefined,
  max = 4
): string[] {
  const byVotes = (list: Array<z.infer<typeof TagSchema>> | null | undefined) =>
    [...(list ?? [])].sort((a, b) => (b.count ?? 0) - (a.count ?? 0)).map((t) => t.name);
  const source = (genres ?? []).length > 0 ? byVotes(genres) : byVotes(tags).slice(0, 2);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const name of source) {
    const label = genreLabel(name);
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(label);
    if (result.length === max) break;
  }
  return result;
}

export class MusicBrainzProvider {
  constructor(private readonly http: UpstreamClient) {}

  /** Release search by barcode, or by title + artist (Lucene query). Best score first. */
  async searchReleases(
    params: { barcode?: string | null; title?: string; artist?: string },
    limit = 5
  ): Promise<MusicBrainzReleaseHit[]> {
    let query: string;
    if (params.barcode) {
      query = `barcode:${params.barcode.replace(/\D/g, '')}`;
    } else if (params.title && params.artist) {
      query = `release:${lucenePhrase(params.title)} AND artist:${lucenePhrase(params.artist)}`;
    } else {
      return [];
    }
    const url = `${MUSICBRAINZ_API}/release?${new URLSearchParams({
      query,
      limit: String(limit),
      fmt: 'json',
    })}`;
    const body = await this.http.getJson(url, ReleaseSearchSchema, { ttlSeconds: 7 * 24 * 3600 });
    return (body?.releases ?? [])
      .map((r) => ({
        mbid: r.id,
        score: r.score ?? 0,
        title: r.title,
        artistName: creditName(r['artist-credit']),
        barcode: r.barcode && r.barcode.length > 0 ? r.barcode : null,
        date: isoDateOrNull(r.date),
        releaseGroupId: r['release-group']?.id ?? null,
      }))
      .sort((a, b) => b.score - a.score);
  }

  /** Full release: label, release group, genres/tags and the tracklist with ISRCs. */
  async getRelease(mbid: string): Promise<MusicBrainzRelease | null> {
    if (!isMbid(mbid)) return null;
    const url = `${MUSICBRAINZ_API}/release/${mbid}?${new URLSearchParams({
      inc: 'artist-credits+labels+release-groups+genres+tags+recordings+isrcs',
      fmt: 'json',
    })}`;
    const r = await this.http.getJson(url, ReleaseLookupSchema, { ttlSeconds: 7 * 24 * 3600 });
    if (!r) return null;

    const credit = r['artist-credit'];
    const firstArtist = credit?.[0]?.artist;
    const artist: ProviderArtist = {
      provider: 'MUSICBRAINZ',
      externalId: firstArtist?.id ?? null,
      name: creditName(credit),
      pictureUrl: null,
    };
    const releaseRef = {
      provider: 'MUSICBRAINZ' as const,
      externalId: r.id,
      title: r.title,
      coverUrl: null,
    };
    const tracks: ProviderTrack[] = [];
    for (const medium of r.media ?? []) {
      for (const t of medium.tracks ?? []) {
        tracks.push({
          provider: 'MUSICBRAINZ',
          externalId: t.recording.id,
          musicbrainzId: t.recording.id,
          title: t.title,
          artist,
          durationMs: Math.max(1000, t.length ?? t.recording.length ?? 1000),
          isrc: normalizeIsrc(t.recording.isrcs?.[0]),
          previewUrl: null,
          trackNumber: t.position ?? null,
          discNumber: medium.position ?? null,
          release: releaseRef,
        });
      }
    }

    const label = (r['label-info'] ?? []).find((li) => li.label)?.label?.name ?? null;
    return {
      provider: 'MUSICBRAINZ',
      externalId: r.id,
      title: r.title,
      artist,
      releaseType: releaseTypeFrom(r['release-group']?.['primary-type']),
      coverUrl: null,
      releaseDate: isoDateOrNull(r.date),
      genres: topGenres(r.genres, r.tags),
      label: label && label !== '[no label]' ? label : null,
      upc: r.barcode && r.barcode.length > 0 ? r.barcode : null,
      trackCount: tracks.length,
      tracks,
      musicbrainzReleaseGroupId: r['release-group']?.id ?? null,
      hasFrontCover: r['cover-art-archive']?.front === true,
    };
  }

  /** Release-group genres (more often voted than the per-edition ones). */
  async getReleaseGroupGenres(releaseGroupId: string): Promise<string[]> {
    if (!isMbid(releaseGroupId)) return [];
    const url = `${MUSICBRAINZ_API}/release-group/${releaseGroupId}?${new URLSearchParams({
      inc: 'genres+tags',
      fmt: 'json',
    })}`;
    const rg = await this.http.getJson(url, ReleaseGroupLookupSchema, {
      ttlSeconds: 7 * 24 * 3600,
    });
    return rg ? topGenres(rg.genres, rg.tags) : [];
  }

  /** Recordings (and their releases) carrying this ISRC. */
  async lookupIsrc(
    isrc: string
  ): Promise<Array<{ recordingId: string; title: string; releaseIds: string[] }>> {
    const code = normalizeIsrc(isrc);
    if (!code) return [];
    const url = `${MUSICBRAINZ_API}/isrc/${code}?${new URLSearchParams({ inc: 'releases', fmt: 'json' })}`;
    const body = await this.http.getJson(url, IsrcLookupSchema, { ttlSeconds: 7 * 24 * 3600 });
    return (body?.recordings ?? []).map((rec) => ({
      recordingId: rec.id,
      title: rec.title,
      releaseIds: (rec.releases ?? []).map((rel) => rel.id),
    }));
  }
}
