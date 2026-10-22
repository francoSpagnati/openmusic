import { UpstreamError } from '../../lib/errors';
import crypto from 'crypto';
import { z } from 'zod';
import { env } from '../../config/env';
import { upstreamSignal, type FetchLike } from '../../lib/upstream';

/** The track a Last.fm user is scrobbling right now (`@attr.nowplaying = "true"`). */
export interface LastFmNowPlaying {
  title: string;
  artist: string;
  album: string | null;
  coverUrl: string | null;
  /** MusicBrainz recording id, when Last.fm knows it. */
  mbid: string | null;
}

/** Outcome of `user.getRecentTracks`, without throwing (the poller branches on it). */
export type LastFmRecentTracksResult =
  /** `nowPlaying` is null when the user is not scrobbling anything right now. */
  | { kind: 'ok'; nowPlaying: LastFmNowPlaying | null }
  | { kind: 'rate_limited' } // error 29
  | { kind: 'not_found' } // error 6: no such user
  | { kind: 'private' } // error 17: recent listening hidden
  | { kind: 'not_configured' } // error 10/26 or no API key: server-side problem
  | { kind: 'error'; detail: string };

const LastFmImageSchema = z.object({ size: z.string().optional(), '#text': z.string() });

// `extended=1`: artist is an object with `name`. Without it, `#text`. Accept both.
const LastFmRecentTrackSchema = z.object({
  name: z.string(),
  mbid: z.string().optional(),
  artist: z.union([z.object({ name: z.string() }), z.object({ '#text': z.string() })]),
  album: z.object({ '#text': z.string() }).partial().optional(),
  image: z.array(LastFmImageSchema).optional(),
  '@attr': z.object({ nowplaying: z.string().optional() }).partial().optional(),
});

const LastFmRecentTracksBodySchema = z.object({
  recenttracks: z.object({
    // A single track comes back as an object instead of an array.
    track: z.union([z.array(LastFmRecentTrackSchema), LastFmRecentTrackSchema]).optional(),
  }),
});

const LastFmErrorBodySchema = z.object({ error: z.number(), message: z.string().optional() });

// Last.fm's grey star placeholder, served when an album has no artwork.
const LASTFM_PLACEHOLDER_IMAGE = '2a96cbd8b46e442fc41c2b86b821562f';

export interface LastFmServiceOptions {
  /** Injected in tests (fixture responses); defaults to the global `fetch`. */
  fetch?: FetchLike;
  /** Overrides LASTFM_API_KEY (tests). */
  apiKey?: string;
}

export interface LastFmSession {
  name: string; // username su Last.fm
  sessionKey: string;
}

export class LastFmService {
  private readonly fetchImpl: FetchLike;
  private readonly apiKey: string;

  constructor(options: LastFmServiceOptions = {}) {
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
    this.apiKey = options.apiKey ?? env.LASTFM_API_KEY;
  }

  private request(url: string): Promise<Response> {
    return this.fetchImpl(url, { signal: upstreamSignal() });
  }

  // HTTPS: the session key returned by auth.getSession is a long-lived credential.
  private readonly authEndpoint = 'https://www.last.fm/api/auth/';
  private readonly apiEndpoint = 'https://ws.audioscrobbler.com/2.0/';

  /** `state` is appended to the callback URL; Last.fm sends it back next to the token. */
  getAuthorizationUrl(state?: string): string {
    const cb = new URL(env.LASTFM_CALLBACK_URL);
    if (state) cb.searchParams.set('state', state);
    const params = new URLSearchParams({
      api_key: env.LASTFM_API_KEY,
      cb: cb.toString(),
    });
    return `${this.authEndpoint}?${params.toString()}`;
  }

  /**
   * Calcola la firma crittografica MD5 richiesta dalle API di Last.fm:
   * Ordine alfabetico dei parametri + shared_secret
   */
  private generateApiSig(params: Record<string, string>): string {
    const sortedKeys = Object.keys(params).sort();
    let signatureRaw = '';
    for (const key of sortedKeys) {
      signatureRaw += `${key}${params[key]}`;
    }
    signatureRaw += env.LASTFM_SHARED_SECRET;
    return crypto.createHash('md5').update(signatureRaw, 'utf8').digest('hex');
  }

  async getSession(token: string): Promise<LastFmSession> {
    const params: Record<string, string> = {
      api_key: env.LASTFM_API_KEY,
      method: 'auth.getSession',
      token,
    };

    const apiSig = this.generateApiSig(params);

    const queryParams = new URLSearchParams({
      ...params,
      api_sig: apiSig,
      format: 'json',
    });

    const response = await this.request(`${this.apiEndpoint}?${queryParams.toString()}`);

    if (!response.ok) {
      const err = await response.text();
      throw new UpstreamError(
        'Last.fm',
        `Last.fm session retrieval failed (${response.status}): ${err}`
      );
    }

    const data = (await response.json()) as {
      session?: {
        name: string;
        key: string;
      };
      message?: string;
      error?: number;
    };

    if (!data.session) {
      throw new UpstreamError('Last.fm', `Last.fm auth error: ${data.message ?? 'Unknown error'}`);
    }

    return {
      name: data.session.name,
      sessionKey: data.session.key,
    };
  }

  /** True when an API key is configured (reading recent tracks needs only the key, no OAuth). */
  get canReadRecentTracks(): boolean {
    return this.apiKey.length > 0 && !this.apiKey.startsWith('your_');
  }

  /**
   * `user.getRecentTracks` (limit 1, extended): the first track with `@attr.nowplaying="true"`
   * is what the user is playing now. Public data: only the API key is needed.
   */
  async getRecentTracks(username: string): Promise<LastFmRecentTracksResult> {
    if (!this.canReadRecentTracks) return { kind: 'not_configured' };
    const params = new URLSearchParams({
      method: 'user.getrecenttracks',
      user: username,
      limit: '1',
      extended: '1',
      api_key: this.apiKey,
      format: 'json',
    });

    let response: Response;
    let json: unknown;
    try {
      response = await this.request(`${this.apiEndpoint}?${params.toString()}`);
      json = await response.json().catch(() => null);
    } catch (err) {
      return { kind: 'error', detail: err instanceof Error ? err.message : 'network error' };
    }

    // Errors come as `{ error, message }`, with a 4xx status or even with 200.
    const apiError = LastFmErrorBodySchema.safeParse(json);
    if (apiError.success) {
      switch (apiError.data.error) {
        case 29:
          return { kind: 'rate_limited' };
        case 6:
          return { kind: 'not_found' };
        case 17:
          return { kind: 'private' };
        case 10:
        case 26:
          return { kind: 'not_configured' };
        default:
          return { kind: 'error', detail: `Last.fm error ${apiError.data.error}` };
      }
    }
    if (response.status === 429) return { kind: 'rate_limited' };
    if (!response.ok) return { kind: 'error', detail: `HTTP ${response.status}` };

    const parsed = LastFmRecentTracksBodySchema.safeParse(json);
    if (!parsed.success) return { kind: 'error', detail: 'unexpected response shape' };
    const raw = parsed.data.recenttracks.track;
    const tracks = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
    const current = tracks.find((t) => t['@attr']?.nowplaying === 'true');
    if (!current) return { kind: 'ok', nowPlaying: null };

    const artist = 'name' in current.artist ? current.artist.name : current.artist['#text'];
    const images = current.image ?? [];
    const cover =
      [...images]
        .reverse()
        .map((i) => i['#text'])
        .find((url) => url.startsWith('https://') && !url.includes(LASTFM_PLACEHOLDER_IMAGE)) ??
      null;
    return {
      kind: 'ok',
      nowPlaying: {
        title: current.name,
        artist,
        album: current.album?.['#text'] || null,
        coverUrl: cover,
        mbid: current.mbid || null,
      },
    };
  }
}
