import React from 'react';
import type { Metadata } from 'next';
import { Article, Scales, SealCheck, ShieldCheck } from '@phosphor-icons/react/dist/ssr';
import { Card } from '../../components/ui';
import { DiscoveryShell, PageOpener } from '../../components/discovery/DiscoveryShell';
import { AccreditationPanel } from './AccreditationPanel';
import { PendingRequestsPanel } from './PendingRequestsPanel';

export const metadata: Metadata = {
  title: 'Critica accreditata',
  description:
    'Come funziona il voto della critica su OpenMusic: testate verificate, link all’articolo originale e soglia fresco/bocciato al 70%. Chiedi l’accredito.',
};

const STEPS = [
  {
    icon: ShieldCheck,
    title: 'Accredito verificato',
    body: 'Chi scrive per una testata invia il link alla propria pagina autore. Lo staff controlla a mano prima di assegnare il badge.',
  },
  {
    icon: Article,
    title: 'Sempre la fonte',
    body: 'Ogni voto della critica mostra un estratto e rimanda all’articolo completo sul sito della testata.',
  },
  {
    icon: Scales,
    title: 'Fresco o bocciato',
    body: 'Un voto da 70/100 (3,5 stelle) in su è “fresco”. Il punteggio è la quota di voti freschi, separata da quella del pubblico.',
  },
] as const;

export default function CriticsPage() {
  return (
    <DiscoveryShell className="space-y-10">
      <PageOpener
        eyebrow="Critica · Accredito"
        icon={<SealCheck weight="duotone" />}
        title={
          <>
            Il voto della critica, <em className="font-normal text-fresh">con la firma.</em>
          </>
        }
        deck="Pubblico e critica restano separati: nessuna recensione anonima, nessun voto comprato."
      />

      <section aria-labelledby="how-heading" className="space-y-4">
        <h2 id="how-heading" className="om-eyebrow">
          Come funziona
        </h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title}>
              <Card padding="md" className="h-full space-y-2">
                <p className="flex items-center gap-2 text-ink">
                  <span className="font-mono text-xs tabular-nums text-ink-muted">0{i + 1}</span>
                  <step.icon aria-hidden="true" weight="duotone" className="h-5 w-5 text-accent" />
                </p>
                <h3 className="om-headline text-lg text-ink">{step.title}</h3>
                <p className="text-sm text-ink-secondary">{step.body}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start [&>*]:min-w-0 [&>*]:flex-1">
        <AccreditationPanel />
        <PendingRequestsPanel />
      </div>
    </DiscoveryShell>
  );
}
