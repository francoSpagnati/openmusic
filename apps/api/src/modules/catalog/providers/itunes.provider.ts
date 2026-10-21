import { z } from 'zod';
import type { UpstreamClient } from '../../../lib/upstream';
import { genreLabel, httpsUrl, isoDateOrNull } from './shared';
import type { ProviderArtist, ProviderRelease, ProviderSearchPage, ProviderTrack } from './types';
import type { ReleaseType } from '@openmusic/shared';

/**
 * iTunes Search API (https://performance-partners.apple.com/search-api), no key needed. Apple
 * documents "approximately 20 calls per minute", so requests are spaced 3 s apart: it is a
 * fallback, never the primary source. It has no ISRC/UPC in search results.
 */
export const ITUNES_API = 'https://itunes.apple.com';

const CollectionSchema = z.object({
  wrapperType: z.literal('collection'),
  collectionId: z.number(),
  collectionName: z.string(),
  artistId: z.number().nullish(),
  artistName: z.string(),
  artworkUrl100: z.string().nullish(),
  trackCount: z.number().nullish(),
  releaseDate: z.string().nullish(),
  primaryGenreName: z.string().nullish(),
});

const SongSchema = z.object({
  wrapperType: z.literal('track'),
  kind: z.string().nullish(),
  trackId: z.number(),
  trackName: z.string(),
  artistId: z.number().nullish(),
  artistName: z.string(),
  collectionId: z.number().nullish(),
  collectionName: z.string().nullish(),
  artworkUrl100: z.string().nullish(),
  previewUrl: z.string().nullish(),
  trackTimeMillis: z.number().nullish(),
  trackNumber: z.number().nullish(),
  discNumber: z.number().nullish(),
});

/** Results mix collections, tracks and artists: each item is parsed on its own. */
const ResultsSchema = z.object({
  resultCount: z.number(),
  results: z.array(z.unknown()),
});

type Collection = z.infer<typeof CollectionSchema>;
type Song = z.infer<typeof SongSchema>;

/**
 * iTunes artwork URLs end in `/{w}x{h}bb.jpg` and the image service renders any size:
 * `100x100bb.jpg` -> `1000x1000bb.jpg`.
 */
export function upscaleItunesArtwork(url: string | null | undefined, size = 1000): string | null {
  const secure = httpsUrl(url);
  if (!secure) return null;
  return secure.replace(/\/\d+x\d+(bb)?\.(jpg|png|webp)$/, `/${size}x${size}bb.jpg`);
}

export function itunesThumbnail(coverUrl: string): string | null {
  return upscaleItunesArtwork(coverUrl, 64);
}

/** "Blonde - Single" -> ["Blonde", SINGLE]; iTunes encodes the type in the collection name. */
function splitCollectionName(name: string): { title: string; type: ReleaseType } {
  const match = /^(.*?)\s+-\s+(Single|EP)$/.exec(name);
  if (!match || !match[1]) return { title: name, type: 'ALBUM' };
  return { title: match[1], type: match[2] === 'EP' ? 'EP' : 'SINGLE' };
}

function parseItems(results: unknown[]): { collections: Collection[]; songs: Song[] } {
  const collections: Collection[] = [];
  const songs: Song[] = [];
  for (const item of results) {
    const collection = CollectionSchema.safeParse(item);
    if (collection.success) {
      collections.push(collection.data);
      continue;
    }
    const song = SongSchema.safeParse(item);
    if (song.success && (song.data.kind ?? 'song') === 'song') songs.push(song.data);
  }
  return { collections, songs };
}

export class ItunesProvider {
  constructor(
    private readonly http: UpstreamClient,
    private readonly country = 'IT'
  ) {}

  async searchAlbums(query: string, limit: number): Promise<ProviderSearchPage<ProviderRelease>> {
    const url = `${ITUNES_API}/search?${new URLSearchParams({
      term: query,
      media: 'music',
      entity: 'album',
      limit: String(limit),
      country: this.country,
    })}`;
    const body = await this.http.getJson(url, ResultsSchema, { ttlSeconds: 6 * 60 * 60 });
    const { collections } = parseItems(body?.results ?? []);
    return { items: collections.map((c) => this.mapCollection(c, null)), total: null };
  }

  async searchTracks(query: string, limit: number): Promise<ProviderSearchPage<ProviderTrack>> {
    const url = `${ITUNES_API}/search?${new URLSearchParams({
      term: query,
      media: 'music',
      entity: 'song',
      limit: String(limit),
      country: this.country,
    })}`;
    const body = await this.http.getJson(url, ResultsSchema, { ttlSeconds: 6 * 60 * 60 });
    const { songs } = parseItems(body?.results ?? []);
    return { items: songs.map((s) => this.mapSong(s)), total: null };
  }

  /** `lookup?id=<collectionId>&entity=song`: the album followed by its tracks. */
  async getAlbum(collectionId: string): Promise<ProviderRelease | null> {
    return this.lookupAlbum(new URLSearchParams({ id: collectionId, entity: 'song' }));
  }

  /** `lookup?upc=<barcode>&entity=song`. */
  async getAlbumByUpc(upc: string): Promise<ProviderRelease | null> {
    return this.lookupAlbum(new URLSearchParams({ upc: upc.replace(/\D/g, ''), entity: 'song' }));
  }

  async getTrack(trackId: string): Promise<ProviderTrack | null> {
    const url = `${ITUNES_API}/lookup?${new URLSearchParams({ id: trackId, country: this.country })}`;
    const body = await this.http.getJson(url, ResultsSchema, { ttlSeconds: 24 * 60 * 60 });
    const { songs } = parseItems(body?.results ?? []);
    const song = songs[0];
    return song ? this.mapSong(song) : null;
  }

  private async lookupAlbum(params: URLSearchParams): Promise<ProviderRelease | null> {
    params.set('country', this.country);
    const body = await this.http.getJson(`${ITUNES_API}/lookup?${params}`, ResultsSchema, {
      ttlSeconds: 24 * 60 * 60,
    });
    const { collections, songs } = parseItems(body?.results ?? []);
    const collection = collections[0];
    if (!collection) return null;
    const tracks = songs
      .filter((s) => s.collectionId === collection.collectionId)
      .sort(
        (a, b) =>
          (a.discNumber ?? 1) - (b.discNumber ?? 1) || (a.trackNumber ?? 0) - (b.trackNumber ?? 0)
      );
    return this.mapCollection(collection, tracks);
  }

  private artist(name: string, id: number | null | undefined): ProviderArtist {
    return {
      provider: 'ITUNES',
      externalId: id ? String(id) : null,
      name,
      pictureUrl: null,
    };
  }

  private mapCollection(c: Collection, songs: Song[] | null): ProviderRelease {
    const { title, type } = splitCollectionName(c.collectionName);
    const coverUrl = upscaleItunesArtwork(c.artworkUrl100);
    return {
      provider: 'ITUNES',
      externalId: String(c.collectionId),
      title,
      artist: this.artist(c.artistName, c.artistId),
      releaseType: type,
      coverUrl,
      releaseDate: isoDateOrNull(c.releaseDate),
      genres: c.primaryGenreName ? [genreLabel(c.primaryGenreName)] : [],
      label: null,
      upc: null,
      trackCount: c.trackCount ?? null,
      tracks: songs
        ? songs.map((s) => ({ ...this.mapSong(s), release: this.releaseRef(c, coverUrl) }))
        : null,
    };
  }

  private releaseRef(c: Collection, coverUrl: string | null) {
    return {
      provider: 'ITUNES' as const,
      externalId: String(c.collectionId),
      title: splitCollectionName(c.collectionName).title,
      coverUrl,
    };
  }

  private mapSong(s: Song): ProviderTrack {
    return {
      provider: 'ITUNES',
      externalId: String(s.trackId),
      title: s.trackName,
      artist: this.artist(s.artistName, s.artistId),
      durationMs: Math.max(1000, s.trackTimeMillis ?? 1000),
      isrc: null,
      previewUrl: httpsUrl(s.previewUrl),
      trackNumber: s.trackNumber ?? null,
      discNumber: s.discNumber ?? null,
      release:
        s.collectionId && s.collectionName
          ? {
              provider: 'ITUNES',
              externalId: String(s.collectionId),
              title: splitCollectionName(s.collectionName).title,
              coverUrl: upscaleItunesArtwork(s.artworkUrl100),
            }
          : null,
    };
  }
}
