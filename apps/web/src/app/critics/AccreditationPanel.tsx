'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Hourglass, Newspaper, SealCheck } from '@phosphor-icons/react';
import type { CriticAccreditationStatus } from '@openmusic/shared';
import { api } from '../../lib/api';
import { loginRedirectUrl, useAuth } from '../../lib/auth';
import { Button, Card, ErrorState, Skeleton, buttonClasses, useToast } from '../../components/ui';
import { formatDate } from '../../components/discovery/format';
import { AccreditationForm } from './AccreditationForm';

type Load =
  | { status: 'loading' }
  | { status: 'ready'; data: CriticAccreditationStatus }
  | { status: 'error' };

/** The viewer's accreditation: sign-in prompt, application form, pending or approved state. */
export function AccreditationPanel() {
  const { status: authStatus, user, refresh } = useAuth();
  const { notify } = useToast();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [token, setToken] = useState(0);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (authStatus !== 'authenticated') return;
    let cancelled = false;
    setLoad({ status: 'loading' });
    api.critic
      .accreditationStatus()
      .then((data) => !cancelled && setLoad({ status: 'ready', data }))
      .catch(() => !cancelled && setLoad({ status: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [authStatus, token]);

  // An admin approved the request since this session started: pick up the new role.
  const approved = load.status === 'ready' && load.data.status === 'APPROVED';
  useEffect(() => {
    if (approved && user && user.role !== 'CRITIC') void refresh();
  }, [approved, user, refresh]);

  const heading = (
    <h2 id="accredito" className="om-headline flex items-center gap-2 text-2xl text-ink">
      <Newspaper aria-hidden="true" weight="duotone" className="h-6 w-6 text-fresh" />
      Accredito per la critica
    </h2>
  );

  if (authStatus === 'loading' || (authStatus === 'authenticated' && load.status === 'loading')) {
    return (
      <Card padding="lg" aria-busy="true" className="space-y-4">
        {heading}
        <span className="sr-only">Caricamento…</span>
        <Skeleton shape="text" lines={4} />
      </Card>
    );
  }

  if (authStatus === 'anonymous') {
    return (
      <Card padding="lg" className="space-y-4">
        {heading}
        <p className="text-sm text-ink-secondary">
          Scrivi di musica per una testata? Accedi o crea un account, poi invia la richiesta: la
          verifichiamo a mano prima di assegnare il badge.
        </p>
        <Link href={loginRedirectUrl('/critics#accredito')} className={buttonClasses()}>
          Accedi per chiedere l’accredito
        </Link>
      </Card>
    );
  }

  if (load.status === 'error') {
    return (
      <Card padding="lg" className="space-y-4">
        {heading}
        <ErrorState
          variant="inline"
          title="Non riesco a leggere lo stato della tua richiesta"
          onRetry={() => setToken((t) => t + 1)}
        />
      </Card>
    );
  }

  if (load.status !== 'ready') return null;
  const { data } = load;

  return (
    <Card padding="lg" className="space-y-5">
      {heading}

      {data.status === 'APPROVED' ? (
        <div className="space-y-3">
          <p className="flex items-start gap-2 text-ink">
            <SealCheck
              aria-hidden="true"
              weight="fill"
              className="mt-0.5 h-5 w-5 shrink-0 text-fresh"
            />
            <span>
              Sei un critico accreditato
              {data.outletName && (
                <>
                  {' '}
                  per <strong>{data.outletName}</strong>
                </>
              )}
              {data.verifiedAt && <> dal {formatDate(data.verifiedAt)}</>}.
            </span>
          </p>
          <p className="text-sm text-ink-secondary">
            Apri la scheda di un disco: al posto della recensione del pubblico troverai il modulo
            per il voto della critica, con il link al tuo articolo.
          </p>
          <Link href="/explore" className={buttonClasses({ variant: 'outline' })}>
            Scegli un disco da recensire
          </Link>
        </div>
      ) : data.status === 'PENDING' && !editing ? (
        <div className="space-y-3" role="status">
          <p className="flex items-start gap-2 text-ink">
            <Hourglass
              aria-hidden="true"
              weight="duotone"
              className="mt-0.5 h-5 w-5 shrink-0 text-accent"
            />
            <span>
              Richiesta in verifica
              {data.outletName && (
                <>
                  {' '}
                  per <strong>{data.outletName}</strong>
                </>
              )}
              {data.requestedAt && <>, inviata il {formatDate(data.requestedAt)}</>}.
            </span>
          </p>
          <p className="text-sm text-ink-secondary">
            Ti avvisiamo con una notifica appena lo staff la approva. Nel frattempo puoi
            correggerla.
          </p>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            Modifica la richiesta
          </Button>
        </div>
      ) : (
        <>
          <p className="text-sm text-ink-secondary">
            Niente recensioni anonime o comprate: ogni voto della critica porta una firma e il link
            all’articolo originale.
          </p>
          <AccreditationForm
            initialOutlet={data.outletName}
            submitLabel={editing ? 'Aggiorna la richiesta' : 'Invia la richiesta'}
            onSubmitted={(next) => {
              setEditing(false);
              setLoad({ status: 'ready', data: next });
              notify({
                title: editing ? 'Richiesta aggiornata' : 'Richiesta inviata',
                description: 'Lo staff la verificherà a mano.',
                tone: 'success',
              });
            }}
          />
          {editing && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Annulla
            </Button>
          )}
        </>
      )}
    </Card>
  );
}
