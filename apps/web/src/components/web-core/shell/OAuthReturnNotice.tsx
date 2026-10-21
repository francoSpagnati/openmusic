'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { ApiErrorCodeSchema, type ApiErrorCode } from '@openmusic/shared';
import { useAuth } from '@/lib/auth';
import { useToast, type ToastOptions } from '@/components/ui';

type OAuthProvider = 'spotify' | 'lastfm';

const PROVIDER_NAME: Record<OAuthProvider, string> = { spotify: 'Spotify', lastfm: 'Last.fm' };

/** Toast for `?oauth=<provider>&status=success|error&code=<ApiErrorCode>`. */
export function oauthReturnMessage(
  provider: OAuthProvider,
  status: 'success' | 'error',
  code: ApiErrorCode | null,
  pathname: string
): ToastOptions {
  const name = PROVIDER_NAME[provider];
  if (status === 'success') {
    // Spotify without a session = "sign in with Spotify", which lands on the home page.
    return provider === 'spotify' && pathname === '/'
      ? { tone: 'success', title: 'Accesso con Spotify effettuato', description: 'Bentornato!' }
      : {
          tone: 'success',
          title: `${name} collegato`,
          description:
            provider === 'spotify'
              ? 'Ora i tuoi amici possono vedere cosa ascolti (se non sei in Ghost Mode).'
              : 'Importeremo i tuoi scrobble per gli ascolti verificati.',
        };
  }
  const title = `Collegamento a ${name} non riuscito`;
  switch (code) {
    case 'BAD_REQUEST':
    case 'VALIDATION_ERROR':
      return {
        tone: 'error',
        title,
        description: `L’autorizzazione è stata annullata o il link è scaduto. Riprova da qui.`,
      };
    case 'UNAUTHORIZED':
      return {
        tone: 'error',
        title,
        description:
          provider === 'lastfm'
            ? 'Accedi a OpenMusic prima di collegare Last.fm.'
            : 'La sessione è scaduta: accedi di nuovo e riprova.',
      };
    case 'CONFLICT':
      return {
        tone: 'error',
        title,
        description: `Questo account ${name} è già collegato a un altro profilo OpenMusic.`,
      };
    case 'FORBIDDEN':
      return { tone: 'error', title, description: `${name} non ha concesso l’accesso.` };
    case 'UPSTREAM_ERROR':
      return {
        tone: 'error',
        title,
        description: `${name} non risponde in questo momento. Riprova tra qualche minuto.`,
      };
    case 'RATE_LIMITED':
      return {
        tone: 'error',
        title,
        description: 'Troppi tentativi: aspetta un minuto e riprova.',
      };
    default:
      return { tone: 'error', title, description: 'Qualcosa è andato storto. Riprova tra poco.' };
  }
}

/**
 * The API's Spotify/Last.fm callbacks redirect the browser back to `/settings`, `/` or `/auth`
 * with the outcome in the query string. Shows it once, refreshes the session (new cookie or
 * newly linked account) and removes the parameters so a reload does not repeat it.
 */
export function OAuthReturnNotice() {
  const params = useSearchParams();
  const pathname = usePathname();
  const { refresh } = useAuth();
  const { notify } = useToast();
  const handled = useRef<string | null>(null);

  useEffect(() => {
    const provider = params.get('oauth');
    const status = params.get('status');
    if (
      (provider !== 'spotify' && provider !== 'lastfm') ||
      (status !== 'success' && status !== 'error')
    ) {
      return;
    }
    const key = params.toString();
    if (handled.current === key) return;
    handled.current = key;

    const code = ApiErrorCodeSchema.safeParse(params.get('code'));
    const message = oauthReturnMessage(
      provider,
      status,
      code.success ? code.data : null,
      pathname ?? '/'
    );
    // Errors stay longer: the user has to read what to do next.
    notify(status === 'error' ? { ...message, duration: 12_000 } : message);
    if (status === 'success') refresh().catch(() => undefined);

    const rest = new URLSearchParams(params.toString());
    for (const name of ['oauth', 'status', 'code']) rest.delete(name);
    const query = rest.toString();
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    );
  }, [params, pathname, notify, refresh]);

  return null;
}
