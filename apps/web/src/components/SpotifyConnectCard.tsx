'use client';

import React, { useState } from 'react';
import { ArrowsClockwise, SpotifyLogo } from '@phosphor-icons/react';
import type { ProviderSyncInfo, SpotifySyncPlaybackResponse } from '@openmusic/shared';
import { api } from '@/lib/api';
import { Button, useToast } from '@/components/ui';
import { ProviderCard } from './web-core/settings/ProviderCard';
import { errorMessage } from './web-core/format';

/**
 * Optional Spotify link: live "now playing" for friends and verified listens. While linked it
 * shows the automatic sync state (ADR-013) and keeps a manual sync as a fallback.
 */
export function SpotifyConnectCard({
  sync,
  autoSyncEnabled,
  onSynced,
}: {
  sync?: ProviderSyncInfo | null;
  autoSyncEnabled?: boolean;
  /** Called after a manual sync (the page re-reads the sync status). */
  onSynced?: () => void;
}) {
  return (
    <ProviderCard
      provider="SPOTIFY"
      name="Spotify"
      icon={<SpotifyLogo weight="fill" />}
      description="Mostra agli amici cosa ascolti e rende verificate le tue recensioni."
      getLoginUrl={() => api.auth.spotifyLoginUrl()}
      sync={sync}
      autoSyncEnabled={autoSyncEnabled}
    >
      <SpotifySync onSynced={onSynced} />
    </ProviderCard>
  );
}

function SpotifySync({ onSynced }: { onSynced?: () => void }) {
  const { notify } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SpotifySyncPlaybackResponse | null>(null);

  async function sync() {
    setSyncing(true);
    try {
      setResult(await api.spotify.syncPlayback());
      onSynced?.();
    } catch (err) {
      onSynced?.();
      notify({
        tone: 'error',
        title: 'Sincronizzazione non riuscita',
        description: errorMessage(err),
      });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p role="status" className="min-w-0 text-sm text-fg-muted">
        {result ? (
          result.track ? (
            <>
              {result.isPlaying ? 'In riproduzione: ' : 'In pausa: '}
              <span className="font-medium text-fg">{result.track.title}</span> di{' '}
              {result.track.artist}
              {result.loggedScrobble && <span className="text-fresh">. Ascolto registrato</span>}
            </>
          ) : (
            result.message
          )
        ) : (
          'Aggiorna subito cosa vedono i tuoi amici.'
        )}
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={() => void sync()}
        loading={syncing}
        loadingLabel="Sincronizzazione…"
        leadingIcon={<ArrowsClockwise aria-hidden="true" />}
      >
        Sincronizza ora
      </Button>
    </div>
  );
}
