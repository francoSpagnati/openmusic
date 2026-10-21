import { UpstreamError } from '../../lib/errors';
import { env } from '../../config/env';
import type {
  SpotifyCurrentlyPlaying,
  SpotifyTrackItem,
  SpotifyTopArtist,
  SpotifyRecentlyPlayedItem,
} from '@openmusic/shared';
import { upstreamFetch } from '../../lib/upstream';

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

export class SpotifyService {
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

    const response = await upstreamFetch(this.tokenEndpoint, {
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

    const response = await upstreamFetch(this.tokenEndpoint, {
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
    const response = await upstreamFetch(`${this.apiBase}/me`, {
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
   * Recupera il brano attualmente in ascolto su Spotify per l'utente.
   * Se nulla è in riproduzione (status 204 o is_playing false), ritorna null.
   */
  async getCurrentlyPlaying(accessToken: string): Promise<SpotifyCurrentlyPlaying | null> {
    const response = await upstreamFetch(`${this.apiBase}/me/player/currently-playing`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (response.status === 204 || response.status === 404) {
      return null;
    }

    if (!response.ok) {
      const err = await response.text();
      throw new UpstreamError(
        'Spotify',
        `Failed to get currently playing (${response.status}): ${err}`
      );
    }

    const data = (await response.json()) as {
      is_playing: boolean;
      progress_ms: number | null;
      timestamp: number;
      item: {
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
      } | null;
    };

    if (!data.item) {
      return {
        isPlaying: false,
        track: null,
        progressMs: 0,
        timestamp: data.timestamp,
      };
    }

    const trackItem: SpotifyTrackItem = {
      id: data.item.id,
      title: data.item.name,
      artist: data.item.artists.map((a) => a.name).join(', '),
      album: data.item.album.name,
      coverUrl: data.item.album.images[0]?.url ?? null,
      isrc: data.item.external_ids?.isrc ?? null,
      durationMs: data.item.duration_ms,
      spotifyUri: data.item.uri,
      externalUrl: data.item.external_urls?.spotify ?? '',
      popularity: data.item.popularity ?? 0,
    };

    return {
      isPlaying: data.is_playing,
      track: trackItem,
      progressMs: data.progress_ms ?? 0,
      timestamp: data.timestamp,
    };
  }

  /**
   * Recupera gli ultimi brani ascoltati (Recently Played).
   */
  async getRecentlyPlayed(
    accessToken: string,
    limit: number = 20
  ): Promise<SpotifyRecentlyPlayedItem[]> {
    const response = await upstreamFetch(
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
    const response = await upstreamFetch(
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
    const response = await upstreamFetch(
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

    const response = await upstreamFetch(`${this.apiBase}/search?${params.toString()}`, {
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
    const response = await upstreamFetch(`${this.apiBase}/users/${spotifyUserId}/playlists`, {
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
      const response = await upstreamFetch(`${this.apiBase}/playlists/${playlistId}/tracks`, {
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
