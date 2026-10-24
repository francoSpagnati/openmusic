'use client';

import React, { useState } from 'react';
import { LinkBreak, LinkSimple } from '@phosphor-icons/react';
import type { ConnectedProvider, ProviderSyncInfo } from '@openmusic/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Badge, Button, Dialog, useToast } from '@/components/ui';
import { errorMessage } from '../format';
import { ProviderSyncStatus } from './ProviderSyncStatus';

export interface ProviderCardProps {
  provider: Extract<ConnectedProvider, 'SPOTIFY' | 'LASTFM'>;
  name: string;
  icon: React.ReactNode;
  description: string;
  /** Returns the provider's consent URL. */
  getLoginUrl: () => Promise<string>;
  /** Extra controls shown while linked (e.g. Spotify sync). */
  children?: React.ReactNode;
  /** ADR-013: automatic sync state; omit to hide the block. */
  sync?: ProviderSyncInfo | null;
  autoSyncEnabled?: boolean;
}

/**
 * An optional linked account. Linking leaves OpenMusic for the provider's consent page;
 * unlinking asks for confirmation first (Nielsen #5).
 */
export function ProviderCard({
  provider,
  name,
  icon,
  description,
  getLoginUrl,
  children,
  sync,
  autoSyncEnabled = true,
}: ProviderCardProps) {
  const { connectedAccounts, refresh } = useAuth();
  const { notify } = useToast();
  const account = connectedAccounts.find((a) => a.provider === provider) ?? null;
  const [connecting, setConnecting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  async function connect() {
    setConnecting(true);
    try {
      window.location.assign(await getLoginUrl());
    } catch (err) {
      setConnecting(false);
      notify({
        tone: 'error',
        title: `Collegamento a ${name} non disponibile`,
        description: errorMessage(err),
      });
    }
  }

  async function disconnect() {
    setDisconnecting(true);
    try {
      await api.auth.disconnectProvider(provider);
      await refresh();
      setConfirming(false);
      notify({ title: `${name} scollegato` });
    } catch (err) {
      notify({
        tone: 'error',
        title: `Non siamo riusciti a scollegare ${name}`,
        description: errorMessage(err),
      });
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="rounded-lg border border-line p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-sunken text-xl text-fg"
          >
            {icon}
          </span>
          <div className="min-w-0">
            <h3 className="flex flex-wrap items-center gap-2 font-medium text-fg">
              {name}
              {account ? (
                <Badge tone="fresh" size="sm" icon={<LinkSimple weight="bold" />}>
                  Collegato
                </Badge>
              ) : (
                <Badge tone="neutral" size="sm">
                  Non collegato
                </Badge>
              )}
            </h3>
            <p className="mt-0.5 text-sm text-fg-muted">
              {account ? (
                <>
                  Account <span className="font-mono">{account.providerId}</span>
                </>
              ) : (
                description
              )}
            </p>
          </div>
        </div>
        {account ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirming(true)}
            leadingIcon={<LinkBreak aria-hidden="true" />}
          >
            Scollega
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void connect()}
            loading={connecting}
            loadingLabel="Apertura…"
            leadingIcon={<LinkSimple aria-hidden="true" />}
          >
            Collega {name}
          </Button>
        )}
      </div>
      {account && sync !== undefined && (
        <div className="mt-4 border-t border-line pt-4">
          <ProviderSyncStatus
            name={name}
            sync={sync}
            autoSyncEnabled={autoSyncEnabled}
            onRelink={() => void connect()}
            relinking={connecting}
          />
        </div>
      )}
      {account && children && <div className="mt-4 border-t border-line pt-4">{children}</div>}

      <Dialog
        open={confirming}
        onClose={() => !disconnecting && setConfirming(false)}
        size="sm"
        title={`Scollegare ${name}?`}
        description={`OpenMusic smetterà di leggere i tuoi ascolti da ${name}. Gli ascolti già registrati restano. Puoi ricollegarlo quando vuoi.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={disconnecting}>
              Annulla
            </Button>
            <Button
              variant="danger"
              onClick={() => void disconnect()}
              loading={disconnecting}
              loadingLabel="Scollegamento…"
            >
              Scollega
            </Button>
          </>
        }
      />
    </div>
  );
}
