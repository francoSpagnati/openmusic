import type { ReleaseType } from '@openmusic/shared';

/** External databases the catalog reads from. */
export type ProviderName = 'DEEZER' | 'ITUNES' | 'MUSICBRAINZ' | 'COVER_ART_ARCHIVE';

/**
 * Provider-neutral shapes. Each provider maps its documented response into these, and the import
 * service is the only place that turns them into database rows.
 */
export interface ProviderArtist {
  provider: ProviderName;
  externalId: string | null;
  name: string;
  pictureUrl: string | null;
}

export interface ProviderTrack {
  provider: ProviderName;
  externalId: string;
  title: string;
  artist: ProviderArtist;
  durationMs: number;
  isrc: string | null;
  previewUrl: string | null;
  trackNumber: number | null;
  discNumber: number | null;
  /** MusicBrainz recording MBID, when the source is MusicBrainz. */
  musicbrainzId?: string | null;
  /** The release the track belongs to (search hits embed a partial album). */
  release: ProviderReleaseRef | null;
}

/** A partial release as embedded in track search results. */
export interface ProviderReleaseRef {
  provider: ProviderName;
  externalId: string;
  title: string;
  coverUrl: string | null;
}

export interface ProviderRelease {
  provider: ProviderName;
  externalId: string;
  title: string;
  artist: ProviderArtist;
  releaseType: ReleaseType;
  /** Largest available artwork (Deezer cover_xl 1000px, iTunes upscaled to 1000x1000). */
  coverUrl: string | null;
  /** ISO date `YYYY-MM-DD` (or `YYYY` / `YYYY-MM` from MusicBrainz), null when unknown. */
  releaseDate: string | null;
  genres: string[];
  label: string | null;
  upc: string | null;
  trackCount: number | null;
  /** Present only when the provider call returned the full tracklist. */
  tracks: ProviderTrack[] | null;
  musicbrainzReleaseGroupId?: string | null;
}

export interface ProviderSearchPage<T> {
  items: T[];
  /** Total hits reported by the provider (for `hasMore`), null when unknown. */
  total: number | null;
}

/** Sizes a provider artwork URL down for the dominant-color sampler (null = unsupported). */
export type ArtworkThumbnailer = (coverUrl: string) => string | null;
