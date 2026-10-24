'use client';

import React from 'react';
import { ArrowsClockwise, PauseCircle, WarningCircle } from '@phosphor-icons/react';
import type { ProviderSyncInfo } from '@openmusic/shared';
import { Badge, Button } from '@/components/ui';
import { TimeAgo } from '../TimeAgo';

export interface ProviderSyncStatusProps {
  name: string;
  /** null while loading or when the status could not be read. */
  sync: ProviderSyncInfo | null;
  autoSyncEnabled: boolean;
  /** Starts the provider's consent flow again (revoked token, refused access). */
  onRelink: () => void;
  relinking: boolean;
}

/**
 * ADR-013: state of the background reading of a linked provider. Status is always shown with
 * text and an icon, never colour alone (Nielsen #1, WCAG 1.4.1).
 */
export function ProviderSyncStatus({
  name,
  sync,
  autoSyncEnabled,
  onRelink,
  relinking,
}: ProviderSyncStatusProps) {
  if (!sync || !sync.linked) return null;

  const lastUpdate = sync.lastSyncedAt ? (
    <>
      Ultimo aggiornamento <TimeAgo iso={sync.lastSyncedAt} className="tabular-nums text-fg" />
    </>
  ) : (
    'Nessuna lettura ancora'
  );

  if (sync.status === 'ERROR') {
    return (
      <div role="status" className="space-y-2">
        <Badge tone="rotten" size="sm" icon={<WarningCircle weight="bold" />}>
          Sincronizzazione interrotta
        </Badge>
        <p className="text-sm text-fg-muted">
          {sync.lastError ?? `Non riusciamo più a leggere ${name}.`}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-fg-subtle">{lastUpdate}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={onRelink}
            loading={relinking}
            loadingLabel="Apertura…"
            leadingIcon={<ArrowsClockwise aria-hidden="true" />}
          >
            Ricollega
          </Button>
        </div>
      </div>
    );
  }

  if (!autoSyncEnabled) {
    return (
      <p role="status" className="text-sm text-fg-muted">
        La sincronizzazione automatica non è attiva su questo server: usa la sincronizzazione
        manuale.
      </p>
    );
  }

  if (sync.status === 'PAUSED') {
    return (
      <div role="status" className="space-y-1">
        <Badge tone="neutral" size="sm" icon={<PauseCircle weight="bold" />}>
          Sincronizzazione in pausa
        </Badge>
        <p className="text-sm text-fg-muted">
          Riprende da sola ora che sei tornato su OpenMusic. {lastUpdate}
        </p>
      </div>
    );
  }

  return (
    <div role="status" className="space-y-1">
      <Badge tone="fresh" size="sm" icon={<ArrowsClockwise weight="bold" />}>
        Sincronizzazione automatica attiva
      </Badge>
      <p className="text-sm text-fg-muted">
        {lastUpdate}
        {sync.lastError ? <span className="text-warning"> · {sync.lastError}</span> : null}
      </p>
    </div>
  );
}
