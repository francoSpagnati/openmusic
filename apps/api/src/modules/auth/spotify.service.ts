import { z } from 'zod';
import { ConflictError, UpstreamError } from '../../lib/errors';
import { env } from '../../config/env';
import type {
  SpotifyCurrentlyPlaying,
  SpotifyTrackItem,
  SpotifyTopArtist,
  SpotifyRecentlyPlayedItem,
} from '@openmusic/shared';
import { parseRetryAfter, upstreamSignal, type FetchLike } from '../../lib/upstream';

/**
 * The refresh token was refused (`invalid_grant`: revoked from the Spotify account page, app
 * removed, password change) or is missing. Only a new OAuth consent fixes it.
 */
export class SpotifyTokenRevokedError extends ConflictError {
  constructor() {
    super('Sessione Spotify scaduta o revocata: ricollega il tuo account Spotify');
  }
}

/** Outcome of `GET /me/player/currently-playing`, without throwing (the poller branches on it). */
export type SpotifyPlaybackResult =
  /** `playback` is null on 204 (nothing playing / no active device). */
  | { kind: 'ok'; playback: SpotifyCurrentlyPlaying | null }
  /** 401: access token expired or revoked. */
  | { kind: 'unauthorized' }
  /** 403: refused for this user (Development Mode allowlist, missing scope). */
  | { kind: 'forbidden' }
  | { kind: 'rate_limited'; retryAfterMs: number | undefined }
  | { kind: 'error'; detail: string };

// Documented shape of a track object (only the fields we read). Local files have `id: null`.
const SpotifyApiTrackSchema = z.object({
  id: z.string().nullable(),
  name: z.string(),
  duration_ms: z.number(),
  uri: z.string(),
  popularity: z.number().optional(),
  external_urls: z.object({ spotify: z.string().optional() }).partial().optional(),
  external_ids: z.object({ isrc: z.string().optional() }).partial().optional(),
  artists: z.array(z.object({ name: z.string() })),
  album: z.object({
    name: z.string(),
    images: z.array(z.object({ url: z.string() })),
  }),
});

const SpotifyCurrentlyPlayingBodySchema = z.object({
  is_playing: z.boolean(),
  progress_ms: z.number().nullable().optional(),
  timestamp: z.number(),
  // Podcasts and ads come back with `item: null` (we do not request `additional_types`).
  item: SpotifyApiTrackSchema.nullable().catch(null),
});

export interface SpotifyTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SpotifyUserProfile {
  id: string;
  displayName: string | null;
  email: string;
  avatarUrl: string | null;
}

export interface SpotifyServiceOptions {
  /** Injected in tests (fixture responses); defaults to the global `fetch`. */
  fetch?: FetchLike;
}

export class SpotifyService {
  private readonly fetchImpl: FetchLike;

  constructor(options: SpotifyServiceOptions = {}) {
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
  }

  /** Every Spotify call, with the upstream timeout (5 s). */
  private request(url: string, init: RequestInit = {}): Promise<Response> {
    return this.fetchImpl(url, { ...init, signal: init.signal ?? upstreamSignal() });
  }

  private readonly authEndpoint = 'https://accounts.spotify.com/authorize';
  private readonly tokenEndpoint = 'https://accounts.spotify.com/api/token';
  private readonly apiBase = 'https://api.spotify.com/v1';

  private readonly scopes = [
    'user-read-currently-playing',
    'user-read-playback-state',
    'user-read-recently-played',
    'user-top-read',
    'playlist-read-private',
    'playlist-modify-public',
    'playlist-modify-private',
    'user-read-email',
    'user-read-private',
  ];

  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: env.SPOTIFY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: env.SPOTIFY_REDIRECT_URI,
      scope: this.scopes.join(' '),
      show_dialog: 'true',
    });

    if (state) {
      params.append('state', state);
    }

    return `${this.authEndpoint}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<SpotifyTokens> {
    const credentials = Buffer.from(
      `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`
    ).toString('base64');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: env.SPOTIFY_REDIRECT_URI,
    });

    const response = await this.request(this.tokenEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new UpstreamError(
        'Spotify',
        `Spotify token exchange failed (${response.status}): ${err}`
      );
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  async refreshAccessToken(
    refreshToken: string
  ): Promise<{ accessToken: string; expiresIn: number; refreshToken?: string }> {
    const credentials = Buffer.from(
      `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`
    ).toString('base64');

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const response = await this.request(this.tokenEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const err = await response.text();
      // RFC 6749 §5.2: a revoked/expired refresh token is `400 { "error": "invalid_grant" }`.
      if (response.status === 400 && /"error"\s*:\s*"invalid_grant"/.test(err)) {
        throw new SpotifyTokenRevokedError();
      }
      throw new UpstreamError(
        'Spotify',
        `Spotify token refresh failed (${response.status}): ${err}`
      );
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
      refresh_token?: string;
    };

    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      refreshToken: data.refresh_token,
    };
  }

  async fetchUserProfile(accessToken: string): Promise<SpotifyUserProfile> {
    const response = await this.request(`${this.apiBase}/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const err = await response.text();
      throw new UpstreamError(
        'Spotify',
        `Failed to fetch Spotify profile (${response.status}): ${err}`
      );
    }

    const data = (await response.json()) as {
      id: string;
      display_name: string | null;
      email: string;
      images?: Array<{ url: string }>;
    };

    const avatarUrl = data.images && data.images.length > 0 ? (data.images[0]?.url ?? null) : null;

    return {
      id: data.id,
      displayName: data.display_name,
      email: data.email,
      avatarUrl,
    };
  }

  /**
   * `GET /me/player/currently-playing` as a result object: 204 = nothing playing, 401/403/429 and
   * failures are reported instead of thrown, so the poller can refresh, stop or back off.
   */
  async fetchCurrentlyPlaying(accessToken: string): Promise<SpotifyPlaybackResult> {
    let response: Response;
    try {
      response = await this.request(`${this.apiBase}/me/player/currently-playing`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (err) {
      return { kind: 'error', detail: err instanceof Error ? err.message : 'network error' };
    }

    if (response.status === 204 || response.status === 404) return { kind: 'ok', playback: null };
    if (response.status === 401) return { kind: 'unauthorized' };
    if (response.status === 403) return { kind: 'forbidden' };
    if (response.status === 429) {
      return {
        kind: 'rate_limited',
        retryAfterMs: parseRetryAfter(response.headers.get('retry-after')),
      };
    }
    if (!response.ok) return { kind: 'error', detail: `HTTP ${response.status}` };

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      // Spotify sometimes answers 200 with an empty body when nothing is playing.
      return { kind: 'ok', playback: null };
    }
    const parsed = SpotifyCurrentlyPlayingBodySchema.safeParse(json);
    if (!parsed.success) return { kind: 'error', detail: 'unexpected response shape' };
    const data = parsed.data;
    return {
      kind: 'ok',
      playback: {
        isPlaying: data.is_playing,
        track: data.item ? toTrackItem(data.item) : null,
        progressMs: data.progress_ms ?? 0,
        timestamp: data.timestamp,
      },
    };
  }

  /**
   * Recupera il brano attualmente in ascolto su Spotify per l'utente.
   * Se nulla è in riproduzione (status 204), ritorna null. Errori → `UpstreamError` (502).
   */
  async getCurrentlyPlaying(accessToken: string): Promise<SpotifyCurrentlyPlaying | null> {
    const result = await this.fetchCurrentlyPlaying(accessToken);
    switch (result.kind) {
      case 'ok':
        return result.playback;
      case 'unauthorized':
        throw new UpstreamError('Spotify', 'Failed to get currently playing (401)');
      case 'forbidden':
        throw new UpstreamError('Spotify', 'Failed to get currently playing (403)');
      case 'rate_limited':
        throw new UpstreamError('Spotify', 'Failed to get currently playing (429)');
      case 'error':
        throw new UpstreamError('Spotify', `Failed to get currently playing: ${result.detail}`);
    }
  }

  /**
   * Recupera gli ultimi brani ascoltati (Recently Played).
   */
  async getRecentlyPlayed(
    accessToken: string,
    limit: number = 20
  ): Promise<SpotifyRecentlyPlayedItem[]> {
    const response = await this.request(
      `${this.apiBase}/me/player/recently-played?limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new UpstreamError(
        'Spotify',
        `Failed to get recently played (${response.status}): ${err}`
      );
    }

    const data = (await response.json()) as {
      items: Array<{
        played_at: string;
        track: {
          id: string;
          name: string;
          duration_ms: number;
          uri: string;
          popularity?: number;
          external_urls?: { spotify?: string };
          external_ids?: { isrc?: string };
          artists: Array<{ name: string }>;
          album: {
            name: string;
            images: Array<{ url: string }>;
          };
        };
      }>;
    };

    return data.items.map((item) => ({
      playedAt: item.played_at,
      track: {
        id: item.track.id,
        title: item.track.name,
        artist: item.track.artists.map((a) => a.name).join(', '),
        album: item.track.album.name,
        coverUrl: item.track.album.images[0]?.url ?? null,
        isrc: item.track.external_ids?.isrc ?? null,
        durationMs: item.track.duration_ms,
        spotifyUri: item.track.uri,
        externalUrl: item.track.external_urls?.spotify ?? '',
        popularity: item.track.popularity ?? 0,
      },
    }));
  }

  /**
   * Recupera i brani più ascoltati dell'utente ("In Rotazione Pesante")
   */
  async getTopTracks(
    accessToken: string,
    timeRange: 'short_term' | 'medium_term' | 'long_term' = 'short_term',
    limit: number = 10
  ): Promise<SpotifyTrackItem[]> {
    const response = await this.request(
      `${this.apiBase}/me/top/tracks?time_range=${timeRange}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new UpstreamError('Spotify', `Failed to get top tracks (${response.status}): ${err}`);
    }

    const data = (await response.json()) as {
      items: Array<{
        id: string;
        name: string;
        duration_ms: number;
        uri: string;
        popularity?: number;
        external_urls?: { spotify?: string };
        external_ids?: { isrc?: string };
        artists: Array<{ name: string }>;
        album: {
          name: string;
          images: Array<{ url: string }>;
        };
      }>;
    };

    return data.items.map((t) => ({
      id: t.id,
      title: t.name,
      artist: t.artists.map((a) => a.name).join(', '),
      album: t.album.name,
      coverUrl: t.album.images[0]?.url ?? null,
      isrc: t.external_ids?.isrc ?? null,
      durationMs: t.duration_ms,
      spotifyUri: t.uri,
      externalUrl: t.external_urls?.spotify ?? '',
      popularity: t.popularity ?? 0,
    }));
  }

  /**
   * Recupera gli artisti preferiti dell'utente
   */
  async getTopArtists(
    accessToken: string,
    timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term',
    limit: number = 10
  ): Promise<SpotifyTopArtist[]> {
    const response = await this.request(
      `${this.apiBase}/me/top/artists?time_range=${timeRange}&limit=${limit}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new UpstreamError('Spotify', `Failed to get top artists (${response.status}): ${err}`);
    }

    const data = (await response.json()) as {
      items: Array<{
        id: string;
        name: string;
        genres: string[];
        popularity: number;
        images: Array<{ url: string }>;
      }>;
    };

    return data.items.map((a) => ({
      id: a.id,
      name: a.name,
      genres: a.genres,
      popularity: a.popularity,
      avatarUrl: a.images[0]?.url ?? null,
    }));
  }

  /**
   * Cerca tracce su Spotify tramite ISRC o query libera
   */
  async searchTracks(
    accessToken: string,
    query: string,
    limit: number = 5
  ): Promise<SpotifyTrackItem[]> {
    const params = new URLSearchParams({
      q: query,
      type: 'track',
      limit: limit.toString(),
    });

    const response = await this.request(`${this.apiBase}/search?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const err = await response.text();
      throw new UpstreamError(
        'Spotify',
        `Spotify track search failed (${response.status}): ${err}`
      );
    }

    const data = (await response.json()) as {
      tracks: {
        items: Array<{
          id: string;
          name: string;
          duration_ms: number;
          uri: string;
          popularity?: number;
          external_urls?: { spotify?: string };
          external_ids?: { isrc?: string };
          artists: Array<{ name: string }>;
          album: {
            name: string;
            images: Array<{ url: string }>;
          };
        }>;
      };
    };

    return data.tracks.items.map((t) => ({
      id: t.id,
      title: t.name,
      artist: t.artists.map((a) => a.name).join(', '),
      album: t.album.name,
      coverUrl: t.album.images[0]?.url ?? null,
      isrc: t.external_ids?.isrc ?? null,
      durationMs: t.duration_ms,
      spotifyUri: t.uri,
      externalUrl: t.external_urls?.spotify ?? '',
      popularity: t.popularity ?? 0,
    }));
  }

  /**
   * Crea una playlist sull'account Spotify dell'utente
   */
  async createPlaylist(
    accessToken: string,
    spotifyUserId: string,
    name: string,
    description: string = 'Creata con OpenMusic (Social Network Musicale Analogico)',
    isPublic: boolean = true
  ): Promise<{ id: string; externalUrl: string }> {
    const response = await this.request(`${this.apiBase}/users/${spotifyUserId}/playlists`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        description,
        public: isPublic,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new UpstreamError(
        'Spotify',
        `Failed to create Spotify playlist (${response.status}): ${err}`
      );
    }

    const data = (await response.json()) as {
      id: string;
      external_urls: { spotify: string };
    };

    return {
      id: data.id,
      externalUrl: data.external_urls.spotify,
    };
  }

  /**
   * Aggiunge tracce tramite i loro Spotify URIs a una playlist esistente
   */
  async addTracksToPlaylist(
    accessToken: string,
    playlistId: string,
    trackUris: string[]
  ): Promise<void> {
    if (trackUris.length === 0) return;

    // Spotify accetta max 100 tracce per request
    const batchSize = 100;
    for (let i = 0; i < trackUris.length; i += batchSize) {
      const batch = trackUris.slice(i, i + batchSize);
      const response = await this.request(`${this.apiBase}/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uris: batch,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new UpstreamError(
          'Spotify',
          `Failed to add tracks to Spotify playlist (${response.status}): ${err}`
        );
      }
    }
  }
}

function toTrackItem(item: z.infer<typeof SpotifyApiTrackSchema>): SpotifyTrackItem {
  return {
    // Local files have no Spotify id: their URI is stable enough to tell tracks apart.
    id: item.id ?? item.uri,
    title: item.name,
    artist: item.artists.map((a) => a.name).join(', '),
    album: item.album.name,
    coverUrl: item.album.images[0]?.url ?? null,
    isrc: item.external_ids?.isrc ?? null,
    durationMs: item.duration_ms,
    spotifyUri: item.uri,
    externalUrl: item.external_urls?.spotify ?? '',
    popularity: item.popularity ?? 0,
  };
}
