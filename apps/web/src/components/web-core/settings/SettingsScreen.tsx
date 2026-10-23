'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Disc, SignOut } from '@phosphor-icons/react';
import type { NowPlayingSyncStatus } from '@openmusic/shared';
import { api } from '@/lib/api';
import { useAuth, useRequireAuth } from '@/lib/auth';
import { Badge, Button, Skeleton, ThemeToggle, useToast } from '@/components/ui';
import { Sidebar } from '@/components/Sidebar';
import { SpotifyConnectCard } from '@/components/SpotifyConnectCard';
import { GhostModeSwitch } from '../GhostModeSwitch';
import { errorMessage, monthYear } from '../format';
import { PasswordForm } from './PasswordForm';
import { ProfileForm } from './ProfileForm';
import { ProviderCard } from './ProviderCard';
import { SettingsSection } from './SettingsSection';

const SECTIONS = [
  { id: 'profilo', label: 'Profilo' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'aspetto', label: 'Aspetto' },
  { id: 'connessioni', label: 'Servizi collegati' },
  { id: 'sicurezza', label: 'Account e sicurezza' },
];

const ROLE_LABEL = {
  USER: 'Ascoltatore',
  CRITIC: 'Critico accreditato',
  MODERATOR: 'Moderatore',
  ADMIN: 'Admin',
} as const;

const SYNC_STATUS_REFRESH_MS = 30_000;

/**
 * ADR-013: automatic Spotify / Last.fm sync state, re-read every 30 s while the page is visible
 * and whenever the linked accounts change. null = not loaded (the cards hide the block).
 */
function useSyncStatus(enabled: boolean, accountsKey: string) {
  const [status, setStatus] = useState<NowPlayingSyncStatus | null>(null);
  const load = useCallback(() => {
    api.nowPlaying
      .syncStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, SYNC_STATUS_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [enabled, accountsKey, load]);

  return { status, reload: load };
}

export function SettingsScreen() {
  const { ready, user } = useRequireAuth();
  const { refresh, logout, connectedAccounts } = useAuth();
  const { notify } = useToast();
  const [loggingOut, setLoggingOut] = useState(false);
  const accountsKey = connectedAccounts.map((a) => `${a.provider}:${a.id}`).join(',');
  const sync = useSyncStatus(Boolean(ready && user), accountsKey);
  const reloadSync = sync.reload;

  // Coming back from Spotify/Last.fm consent: pick up the newly linked account.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refresh().catch(() => undefined);
        reloadSync();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh, reloadSync]);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch (err) {
      notify({ tone: 'error', title: 'Uscita non riuscita', description: errorMessage(err) });
      setLoggingOut(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-7xl justify-center">
      <Sidebar />
      <div className="min-w-0 flex-1 px-4 pb-8 pt-10 sm:px-6 lg:px-12 lg:pt-14">
        <div className="mx-auto w-full max-w-[42rem]">
          <header className="om-enter">
            <h1 className="om-headline text-display-sm text-fg">Impostazioni</h1>
            <p className="om-deck mt-2 text-fg-muted">
              Il tuo profilo, la privacy dei tuoi ascolti e i servizi collegati.
            </p>
          </header>

          <nav aria-label="Sezioni delle impostazioni" className="-mx-2 mb-6 mt-8 overflow-x-auto">
            <ul className="flex gap-1 px-2">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="inline-flex h-9 items-center whitespace-nowrap rounded-md px-2.5 text-sm text-fg-muted hover:bg-fg/[0.04] hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {!ready || !user ? (
            <div aria-busy="true" className="space-y-6 border-t border-line pt-10">
              <span className="sr-only" role="status">
                Caricamento delle impostazioni…
              </span>
              <Skeleton shape="rect" className="h-80" />
              <Skeleton shape="rect" className="h-40" />
            </div>
          ) : (
            <>
              <SettingsSection
                id="profilo"
                title="Profilo"
                description="Queste informazioni sono visibili a chiunque apra il tuo profilo."
              >
                <ProfileForm user={user} />
              </SettingsSection>

              <SettingsSection
                id="privacy"
                title="Privacy"
                description="Decidi tu se gli amici vedono cosa stai ascoltando, in tempo reale."
              >
                <GhostModeSwitch variant="detailed" className="rounded-lg border border-line p-4" />
              </SettingsSection>

              <SettingsSection
                id="aspetto"
                title="Aspetto"
                description="Chiaro, scuro o come il tuo sistema. La scelta resta su questo browser."
              >
                <ThemeToggle />
              </SettingsSection>

              <SettingsSection
                id="connessioni"
                title="Servizi collegati"
                description="OpenMusic funziona anche senza: collegarli aggiunge ascolto live e recensioni verificate."
              >
                <div className="space-y-3">
                  <SpotifyConnectCard
                    sync={sync.status?.providers.SPOTIFY ?? null}
                    autoSyncEnabled={sync.status?.autoSyncEnabled ?? true}
                    onSynced={sync.reload}
                  />
                  <ProviderCard
                    provider="LASTFM"
                    name="Last.fm"
                    icon={<Disc weight="fill" />}
                    description="Importa i tuoi scrobble per l'heavy rotation e gli ascolti verificati."
                    getLoginUrl={() => api.auth.lastFmLoginUrl()}
                    sync={sync.status?.providers.LASTFM ?? null}
                    autoSyncEnabled={sync.status?.autoSyncEnabled ?? true}
                  />
                  <p className="pt-2 text-xs text-fg-subtle">
                    Dopo l’autorizzazione tornerai su questa pagina con l’esito del collegamento.
                    Quando un servizio è collegato, OpenMusic legge da solo cosa stai ascoltando:
                    spesso mentre tu o i tuoi amici siete online, più di rado quando non ci siete.
                    In Ghost Mode gli amici non lo vedono.
                  </p>
                </div>
              </SettingsSection>

              <SettingsSection id="sicurezza" title="Account e sicurezza">
                <dl className="mb-6 grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-[13px] text-fg-subtle">Email</dt>
                    <dd className="mt-1 break-all text-sm text-fg">{user.email}</dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-fg-subtle">Username</dt>
                    <dd className="mt-1 text-sm text-fg">@{user.username}</dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-fg-subtle">Ruolo</dt>
                    <dd className="mt-1">
                      <Badge tone={user.role === 'USER' ? 'neutral' : 'accent'} size="sm">
                        {ROLE_LABEL[user.role]}
                      </Badge>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[13px] text-fg-subtle">Iscritto da</dt>
                    <dd className="mt-1 text-sm text-fg">{monthYear(user.createdAt)}</dd>
                  </div>
                </dl>
                <h3 className="mb-4 border-t border-line pt-8 text-base font-medium text-fg">
                  {user.hasPassword ? 'Cambia password' : 'Imposta una password'}
                </h3>
                <PasswordForm hasPassword={user.hasPassword} email={user.email} />
                <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
                  <p className="text-sm text-fg-muted">Esci da OpenMusic su questo browser.</p>
                  <Button
                    variant="danger"
                    onClick={() => void handleLogout()}
                    loading={loggingOut}
                    loadingLabel="Uscita…"
                    leadingIcon={<SignOut aria-hidden="true" weight="bold" />}
                  >
                    Esci
                  </Button>
                </div>
              </SettingsSection>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
