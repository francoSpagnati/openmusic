import { z } from 'zod';
import { normalizeBarcode, normalizeIsrc } from '@openmusic/shared';
import type { UpstreamClient } from '../../../lib/upstream';
import { genreLabel, httpsUrl, isoDateOrNull, releaseTypeFrom } from './shared';
import type { ProviderArtist, ProviderRelease, ProviderSearchPage, ProviderTrack } from './types';

/**
 * Deezer public API (https://developers.deezer.com/api), no key needed. Quota: 50 requests per
 * 5 seconds per IP. Errors come back as HTTP 200 with `{ "error": { type, message, code } }`.
 */
export const DEEZER_API = 'https://api.deezer.com';

// -- Documented response shapes (only the fields we use; unknown keys are ignored) ------------

const DeezerErrorSchema = z.object({
  error: z.object({
    type: z.string().optional(),
    message: z.string().optional(),
    code: z.number().optional(),
  }),
});

const ArtistRefSchema = z.object({
  id: z.number(),
  name: z.string(),
  picture_xl: z.string().nullish(),
});

const AlbumRefSchema = z.object({
  id: z.number(),
  title: z.string(),
  cover_xl: z.string().nullish(),
});

const SearchTrackSchema = z.object({
  id: z.number(),
  title: z.string(),
  duration: z.number(),
  preview: z.string().nullish(),
  artist: ArtistRefSchema,
  album: AlbumRefSchema,
});

const SearchAlbumSchema = z.object({
  id: z.number(),
  title: z.string(),
  cover_xl: z.string().nullish(),
  nb_tracks: z.number().nullish(),
  record_type: z.string().nullish(),
  artist: ArtistRefSchema,
});

const AlbumTrackSchema = z.object({
  id: z.number(),
  title: z.string(),
  duration: z.number(),
  preview: z.string().nullish(),
  isrc: z.string().nullish(),
  track_position: z.number().nullish(),
  disk_number: z.number().nullish(),
  artist: ArtistRefSchema,
});

const AlbumDetailSchema = z.object({
  id: z.number(),
  title: z.string(),
  upc: z.string().nullish(),
  cover_xl: z.string().nullish(),
  label: z.string().nullish(),
  nb_tracks: z.number().nullish(),
  release_date: z.string().nullish(),
  record_type: z.string().nullish(),
  genres: z.object({ data: z.array(z.object({ id: z.number(), name: z.string() })) }).nullish(),
  artist: ArtistRefSchema,
  tracks: z.object({ data: z.array(AlbumTrackSchema) }).nullish(),
});

const TrackDetailSchema = z.object({
  id: z.number(),
  title: z.string(),
  isrc: z.string().nullish(),
  duration: z.number(),
  track_position: z.number().nullish(),
  disk_number: z.number().nullish(),
  preview: z.string().nullish(),
  artist: ArtistRefSchema,
  album: AlbumRefSchema,
});

function listSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    total: z.number().nullish(),
    next: z.string().nullish(),
  });
}

const SearchAlbumListSchema = listSchema(SearchAlbumSchema);
const SearchTrackListSchema = listSchema(SearchTrackSchema);
const SearchArtistListSchema = listSchema(ArtistRefSchema);
const AlbumTrackListSchema = listSchema(AlbumTrackSchema);

export type DeezerAlbumDetail = z.infer<typeof AlbumDetailSchema>;

/** Deezer reports errors with HTTP 200. Code 800 = no data, 4 = quota, 700 = busy. */
export function detectDeezerError(
  body: unknown
): { message: string; retryable: boolean; notFound?: boolean } | null {
  const parsed = DeezerErrorSchema.safeParse(body);
  if (!parsed.success) return null;
  const { code, message, type } = parsed.data.error;
  const text = `${type ?? 'Error'} ${code ?? ''}: ${message ?? ''}`.trim();
  if (code === 800) return { message: text, retryable: false, notFound: true };
  return { message: text, retryable: code === 4 || code === 700 };
}

/** Deezer CDN artwork can be requested at any size: a 64px copy is enough for the color. */
export function deezerThumbnail(coverUrl: string): string | null {
  const resized = coverUrl.replace(
    /\/\d+x\d+-([0-9a-f]{6})-(\d+)-0-0\.jpg$/,
    '/64x64-$1-$2-0-0.jpg'
  );
  return resized;
}

function mediaUrl(value: string | null | undefined): string | null {
  return value && value.length > 0 ? httpsUrl(value) : null;
}

export class DeezerProvider {
  constructor(private readonly http: UpstreamClient) {}

  async searchAlbums(
    query: string,
    options: { limit: number; offset: number }
  ): Promise<ProviderSearchPage<ProviderRelease>> {
    const url = `${DEEZER_API}/search/album?${new URLSearchParams({
      q: query,
      limit: String(options.limit),
      index: String(options.offset),
    })}`;
    const body = await this.http.getJson(url, SearchAlbumListSchema, { ttlSeconds: 60 * 60 });
    if (!body) return { items: [], total: 0 };
    return {
      items: body.data.map((album) => ({
        provider: 'DEEZER',
        externalId: String(album.id),
        title: album.title,
        artist: this.mapArtist(album.artist),
        releaseType: releaseTypeFrom(album.record_type),
        coverUrl: mediaUrl(album.cover_xl),
        releaseDate: null,
        genres: [],
        label: null,
        upc: null,
        trackCount: album.nb_tracks ?? null,
        tracks: null,
      })),
      total: body.total ?? null,
    };
  }

  async searchTracks(
    query: string,
    options: { limit: number; offset: number }
  ): Promise<ProviderSearchPage<ProviderTrack>> {
    const url = `${DEEZER_API}/search/track?${new URLSearchParams({
      q: query,
      limit: String(options.limit),
      index: String(options.offset),
    })}`;
    const body = await this.http.getJson(url, SearchTrackListSchema, { ttlSeconds: 60 * 60 });
    if (!body) return { items: [], total: 0 };
    return {
      items: body.data.map((track) => ({
        provider: 'DEEZER',
        externalId: String(track.id),
        title: track.title,
        artist: this.mapArtist(track.artist),
        durationMs: Math.max(1, track.duration) * 1000,
        isrc: null,
        previewUrl: mediaUrl(track.preview),
        trackNumber: null,
        discNumber: null,
        release: {
          provider: 'DEEZER',
          externalId: String(track.album.id),
          title: track.album.title,
          coverUrl: mediaUrl(track.album.cover_xl),
        },
      })),
      total: body.total ?? null,
    };
  }

  async searchArtists(query: string, limit = 5): Promise<ProviderArtist[]> {
    const url = `${DEEZER_API}/search/artist?${new URLSearchParams({ q: query, limit: String(limit) })}`;
    const body = await this.http.getJson(url, SearchArtistListSchema, { ttlSeconds: 60 * 60 });
    return body ? body.data.map((artist) => this.mapArtist(artist)) : [];
  }

  /** Album detail plus the full tracklist (with ISRCs and positions from `/album/{id}/tracks`). */
  async getAlbum(id: string): Promise<ProviderRelease | null> {
    const album = await this.http.getJson(
      `${DEEZER_API}/album/${encodeURIComponent(id)}`,
      AlbumDetailSchema,
      {
        ttlSeconds: 24 * 60 * 60,
      }
    );
    if (!album) return null;
    const tracklist = await this.http.getJson(
      `${DEEZER_API}/album/${encodeURIComponent(id)}/tracks?limit=200`,
      AlbumTrackListSchema,
      { ttlSeconds: 24 * 60 * 60 }
    );
    return this.mapAlbumDetail(album, tracklist?.data ?? album.tracks?.data ?? []);
  }

  /** `GET /album/upc:<barcode>`. */
  async getAlbumByUpc(upc: string): Promise<ProviderRelease | null> {
    const barcode = normalizeBarcode(upc);
    if (!barcode) return null;
    const album = await this.http.getJson(
      `${DEEZER_API}/album/upc:${upc.replace(/\D/g, '')}`,
      AlbumDetailSchema,
      {
        ttlSeconds: 24 * 60 * 60,
      }
    );
    return album ? this.getAlbum(String(album.id)) : null;
  }

  /**
   * `fresh` skips the cache and keeps the response briefly: the `preview` URL is signed and
   * expires after ~15 minutes, so a day-old cached copy would hand out a dead link.
   */
  async getTrack(id: string, options: { fresh?: boolean } = {}): Promise<ProviderTrack | null> {
    const track = await this.http.getJson(
      `${DEEZER_API}/track/${encodeURIComponent(id)}`,
      TrackDetailSchema,
      options.fresh
        ? { ttlSeconds: 60, bypassCache: true }
        : {
            ttlSeconds: 24 * 60 * 60,
          }
    );
    return track ? this.mapTrackDetail(track) : null;
  }

  /** `GET /track/isrc:<ISRC>`. */
  async getTrackByIsrc(isrc: string): Promise<ProviderTrack | null> {
    const code = normalizeIsrc(isrc);
    if (!code) return null;
    const track = await this.http.getJson(`${DEEZER_API}/track/isrc:${code}`, TrackDetailSchema, {
      ttlSeconds: 24 * 60 * 60,
    });
    return track ? this.mapTrackDetail(track) : null;
  }

  private mapArtist(artist: z.infer<typeof ArtistRefSchema>): ProviderArtist {
    return {
      provider: 'DEEZER',
      externalId: String(artist.id),
      name: artist.name,
      pictureUrl: mediaUrl(artist.picture_xl),
    };
  }

  private mapAlbumDetail(
    album: DeezerAlbumDetail,
    tracks: Array<z.infer<typeof AlbumTrackSchema>>
  ): ProviderRelease {
    const releaseRef = {
      provider: 'DEEZER' as const,
      externalId: String(album.id),
      title: album.title,
      coverUrl: mediaUrl(album.cover_xl),
    };
    return {
      provider: 'DEEZER',
      externalId: String(album.id),
      title: album.title,
      artist: this.mapArtist(album.artist),
      releaseType: releaseTypeFrom(album.record_type),
      coverUrl: mediaUrl(album.cover_xl),
      releaseDate: isoDateOrNull(album.release_date),
      genres: (album.genres?.data ?? []).map((g) => genreLabel(g.name)),
      label: album.label && album.label.length > 0 ? album.label : null,
      upc: album.upc && album.upc.length > 0 ? album.upc : null,
      trackCount: album.nb_tracks ?? tracks.length,
      tracks: tracks.map((track, index) => ({
        provider: 'DEEZER',
        externalId: String(track.id),
        title: track.title,
        artist: this.mapArtist(track.artist),
        durationMs: Math.max(1, track.duration) * 1000,
        isrc: normalizeIsrc(track.isrc),
        previewUrl: mediaUrl(track.preview),
        trackNumber: track.track_position ?? index + 1,
        discNumber: track.disk_number ?? 1,
        release: releaseRef,
      })),
    };
  }

  private mapTrackDetail(track: z.infer<typeof TrackDetailSchema>): ProviderTrack {
    return {
      provider: 'DEEZER',
      externalId: String(track.id),
      title: track.title,
      artist: this.mapArtist(track.artist),
      durationMs: Math.max(1, track.duration) * 1000,
      isrc: normalizeIsrc(track.isrc),
      previewUrl: mediaUrl(track.preview),
      trackNumber: track.track_position ?? null,
      discNumber: track.disk_number ?? null,
      release: {
        provider: 'DEEZER',
        externalId: String(track.album.id),
        title: track.album.title,
        coverUrl: mediaUrl(track.album.cover_xl),
      },
    };
  }
}
