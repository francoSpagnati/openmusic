import { env } from '../../config/env';

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
  private readonly apiEndpoint = 'https://api.spotify.com/v1/me';

  private readonly scopes = [
    'user-read-currently-playing',
    'user-read-playback-state',
    'user-read-recently-played',
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

    const response = await fetch(this.tokenEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Spotify token exchange failed (${response.status}): ${err}`);
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

  async fetchUserProfile(accessToken: string): Promise<SpotifyUserProfile> {
    const response = await fetch(this.apiEndpoint, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Failed to fetch Spotify profile (${response.status}): ${err}`);
    }

    const data = (await response.json()) as {
      id: string;
      display_name: string | null;
      email: string;
      images?: Array<{ url: string }>;
    };

    const avatarUrl = data.images && data.images.length > 0 ? data.images[0]?.url ?? null : null;

    return {
      id: data.id,
      displayName: data.display_name,
      email: data.email,
      avatarUrl,
    };
  }
}
