import {
  UpstreamClient,
  type Clock,
  type FetchLike,
  type ResponseCache,
  systemClock,
} from '../../../lib/upstream';
import { OPENMUSIC_VERSION } from '../../../lib/version';
import { CoverArtArchiveProvider } from './cover-art-archive.provider';
import { DeezerProvider, deezerThumbnail, detectDeezerError } from './deezer.provider';
import { ItunesProvider, itunesThumbnail } from './itunes.provider';
import { MusicBrainzProvider } from './musicbrainz.provider';

export { CoverArtArchiveProvider } from './cover-art-archive.provider';
export { DeezerProvider } from './deezer.provider';
export { ItunesProvider } from './itunes.provider';
export { MusicBrainzProvider } from './musicbrainz.provider';
export type * from './types';

export interface CatalogProviders {
  deezer: DeezerProvider;
  itunes: ItunesProvider;
  musicbrainz: MusicBrainzProvider;
  coverArt: CoverArtArchiveProvider;
  /** Plain client (no cache) used to download small artwork for the dominant color. */
  images: UpstreamClient;
  thumbnailFor(coverUrl: string): string | null;
}

export interface CatalogProvidersOptions {
  fetch?: FetchLike;
  cache?: ResponseCache;
  clock?: Clock;
  /** Contact URL or email for the MusicBrainz User-Agent (required by their API policy). */
  musicbrainzContact: string;
  itunesCountry?: string;
}

/** `OpenMusic/<version> ( <contact> )`, the format MusicBrainz asks for. */
export function musicBrainzUserAgent(contact: string): string {
  return `OpenMusic/${OPENMUSIC_VERSION} ( ${contact} )`;
}

export function createCatalogProviders(options: CatalogProvidersOptions): CatalogProviders {
  const common = {
    fetch: options.fetch,
    cache: options.cache,
    clock: options.clock ?? systemClock,
  };
  const userAgent = { 'User-Agent': musicBrainzUserAgent(options.musicbrainzContact) };

  // Deezer: 50 requests / 5 s -> bursts of 10, then one every 110 ms.
  const deezer = new UpstreamClient({
    ...common,
    provider: 'deezer',
    minIntervalMs: 110,
    burst: 10,
    maxQueue: 50,
    detectError: detectDeezerError,
  });
  // iTunes: ~20 / minute -> bursts of 3 (album + song search), then one every 3 s.
  const itunes = new UpstreamClient({
    ...common,
    provider: 'itunes',
    minIntervalMs: 3_000,
    burst: 3,
    maxQueue: 5,
    defaultTtlSeconds: 6 * 3600,
  });
  // MusicBrainz: 1 / second, mandatory User-Agent.
  const musicbrainz = new UpstreamClient({
    ...common,
    provider: 'musicbrainz',
    minIntervalMs: 1_100,
    maxQueue: 30,
    headers: userAgent,
    baseBackoffMs: 1_100,
  });
  const coverArt = new UpstreamClient({
    ...common,
    provider: 'coverartarchive',
    minIntervalMs: 250,
    maxQueue: 30,
    headers: userAgent,
  });
  const images = new UpstreamClient({
    fetch: options.fetch,
    clock: common.clock,
    provider: 'images',
    minIntervalMs: 0,
    maxRetries: 1,
    headers: { Accept: 'image/jpeg,image/png;q=0.9,*/*;q=0.1' },
  });

  return {
    deezer: new DeezerProvider(deezer),
    itunes: new ItunesProvider(itunes, options.itunesCountry),
    musicbrainz: new MusicBrainzProvider(musicbrainz),
    coverArt: new CoverArtArchiveProvider(coverArt),
    images,
    thumbnailFor(coverUrl: string): string | null {
      const host = safeHost(coverUrl);
      if (!host) return null;
      if (hostIn(host, 'dzcdn.net')) return deezerThumbnail(coverUrl);
      if (hostIn(host, 'mzstatic.com')) return itunesThumbnail(coverUrl);
      // CAA thumbnails: `<id>-1200.jpg` -> `<id>-250.jpg`.
      if (hostIn(host, 'coverartarchive.org') || hostIn(host, 'archive.org')) {
        return coverUrl.replace(/-(?:500|1200)\.jpg$/, '-250.jpg');
      }
      return null;
    },
  };
}

function safeHost(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.hostname : null;
  } catch {
    return null;
  }
}

/** `host` is `domain` or one of its subdomains (`evil-dzcdn.net` is not `dzcdn.net`). */
function hostIn(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}
