'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowSquareOut, Check, X } from '@phosphor-icons/react';
import type { PendingCriticRequest } from '@openmusic/shared';
import { api, isApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { externalHref } from '../../lib/url';
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  useToast,
} from '../../components/ui';
import { formatRelative } from '../../components/discovery/format';

/** ADMIN queue: approve or reject critic accreditation requests. Hidden for everyone else. */
export function PendingRequestsPanel() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const { notify } = useToast();
  const [requests, setRequests] = useState<PendingCriticRequest[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setRequests(await api.critic.pendingRequests());
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  if (!isAdmin) return null;

  const decide = async (request: PendingCriticRequest, approve: boolean) => {
    setBusy(request.userId);
    try {
      await api.critic.verify(request.userId, approve);
      setRequests((list) => (list ?? []).filter((r) => r.userId !== request.userId));
      notify({
        title: approve ? `${request.outletName}: accredito approvato` : 'Richiesta respinta',
        description: approve
          ? `@${request.username} ora è un critico.`
          : `@${request.username} potrà inviarne un’altra.`,
        tone: approve ? 'success' : 'neutral',
      });
    } catch (err) {
      notify({
        title: 'Decisione non salvata',
        description: isApiError(err) ? err.message : 'Riprova tra poco.',
        tone: 'error',
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card padding="lg" as="section" aria-labelledby="pending-heading" className="space-y-4">
      <div>
        <p className="om-eyebrow">Solo staff</p>
        <h2 id="pending-heading" className="om-headline text-2xl text-ink">
          Richieste da verificare
        </h2>
      </div>
      {failed ? (
        <ErrorState variant="inline" title="Coda non disponibile" onRetry={() => void load()} />
      ) : requests === null ? (
        <div aria-busy="true">
          <span className="sr-only">Caricamento delle richieste…</span>
          <Skeleton shape="text" lines={3} />
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          size="compact"
          title="Coda vuota"
          description="Nessuna richiesta di accredito in attesa."
        />
      ) : (
        <ul className="divide-y divide-line">
          {requests.map((r) => {
            const name = r.displayName ?? r.username;
            return (
              <li key={r.userId} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={name} size="sm" decorative />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">
                      <strong>{r.outletName}</strong> · {name}{' '}
                      <span className="text-ink-muted">@{r.username}</span>
                    </p>
                    <p className="flex flex-wrap gap-x-3 text-xs text-ink-secondary">
                      <time dateTime={r.requestedAt}>{formatRelative(r.requestedAt)}</time>
                      {externalHref(r.portfolioUrl) && (
                        <a
                          href={externalHref(r.portfolioUrl) ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-accent underline-offset-4 hover:underline"
                        >
                          Portfolio
                          <ArrowSquareOut aria-hidden="true" className="h-3 w-3" />
                          <span className="sr-only">(si apre in una nuova scheda)</span>
                        </a>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="danger"
                    leadingIcon={<X />}
                    disabled={busy !== null}
                    loading={busy === r.userId}
                    onClick={() => void decide(r, false)}
                    aria-label={`Respingi ${r.outletName}, ${name}`}
                  >
                    Respingi
                  </Button>
                  <Button
                    size="sm"
                    leadingIcon={<Check weight="bold" />}
                    disabled={busy !== null}
                    loading={busy === r.userId}
                    onClick={() => void decide(r, true)}
                    aria-label={`Approva ${r.outletName}, ${name}`}
                  >
                    Approva
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
