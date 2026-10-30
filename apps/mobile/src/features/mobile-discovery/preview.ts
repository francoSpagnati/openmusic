import type {
  AudioPreviewResolveQuery,
  AudioPreviewResult,
  AudioPreviewSource,
} from '@openmusic/shared';
import { api, resolveApiUrl } from '../../lib/api';

/** The fields of a `CatalogTrack` needed to find its 30s clip. */
export interface PreviewTrack {
  id: string;
  title: string;
  artistName: string;
  isrc?: string | null;
  previewUrl?: string | null;
}

export interface ResolvedPreview {
  /** Null when no database has a clip for this track (`source: 'NONE'`). */
  url: string | null;
  /** `CATALOG` = the URL was already stored on the track. */
  source: AudioPreviewSource | 'CATALOG';
}

export type PreviewLookup = (query: AudioPreviewResolveQuery) => Promise<AudioPreviewResult>;

export interface PreviewResolver {
  /** Stored `previewUrl` first, else `GET /api/catalog/preview` (Spotify → Deezer → iTunes). */
  resolve(track: PreviewTrack): Promise<ResolvedPreview>;
  /** Already-known result, without a request (undefined = not resolved yet). */
  peek(track: PreviewTrack): ResolvedPreview | undefined;
  clear(): void;
}

function cacheKey(track: PreviewTrack): string {
  return track.isrc
    ? `isrc:${track.isrc.toUpperCase()}`
    : `q:${track.artistName.trim().toLowerCase()}|${track.title.trim().toLowerCase()}`;
}

/**
 * Resolves 30s preview URLs once per track and shares in-flight requests, so pre-buffering the
 * next reels and pressing play on them never asks the API twice. Failed lookups are forgotten
 * (the next attempt retries); "no preview" answers are cached.
 */
export function createPreviewResolver(lookup: PreviewLookup): PreviewResolver {
  const pending = new Map<string, Promise<ResolvedPreview>>();
  const settled = new Map<string, ResolvedPreview>();

  return {
    resolve(track) {
      if (track.previewUrl) {
        return Promise.resolve({ url: resolveApiUrl(track.previewUrl), source: 'CATALOG' });
      }
      const key = cacheKey(track);
      const known = settled.get(key);
      if (known) return Promise.resolve(known);
      const inFlight = pending.get(key);
      if (inFlight) return inFlight;

      const request = lookup({
        title: track.title,
        artist: track.artistName,
        ...(track.isrc ? { isrc: track.isrc } : {}),
      })
        .then((res): ResolvedPreview => {
          const value: ResolvedPreview = { url: res.previewUrl, source: res.source };
          settled.set(key, value);
          return value;
        })
        .finally(() => pending.delete(key));
      pending.set(key, request);
      return request;
    },
    peek(track) {
      if (track.previewUrl) return { url: resolveApiUrl(track.previewUrl), source: 'CATALOG' };
      return settled.get(cacheKey(track));
    },
    clear() {
      pending.clear();
      settled.clear();
    },
  };
}

/** App-wide resolver on the real API. */
export const previewResolver = createPreviewResolver((query) => api.catalog.preview(query));

/**
 * Indices to pre-buffer after `active`: N+1 and N+2 by default (Doherty threshold: the next
 * clip must start in < 400 ms), clipped to the list.
 */
export function lookaheadIndices(active: number, length: number, ahead = 2): number[] {
  const out: number[] = [];
  for (let i = active + 1; i <= active + ahead && i < length; i++) {
    if (i >= 0) out.push(i);
  }
  return out;
}

/** "DEEZER" → "Deezer", for "Anteprima da Deezer". */
export function previewSourceLabel(source: ResolvedPreview['source']): string | null {
  switch (source) {
    case 'SPOTIFY':
      return 'Spotify';
    case 'DEEZER':
      return 'Deezer';
    case 'ITUNES':
      return 'iTunes';
    case 'CATALOG':
      return 'catalogo';
    case 'NONE':
      return null;
  }
}
