import { UpstreamError } from '../../lib/errors';
import crypto from 'crypto';
import { env } from '../../config/env';
import { upstreamFetch } from '../../lib/upstream';

export interface LastFmSession {
  name: string; // username su Last.fm
  sessionKey: string;
}

export class LastFmService {
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

    const response = await upstreamFetch(`${this.apiEndpoint}?${queryParams.toString()}`);

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
}
