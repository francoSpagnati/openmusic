import React from 'react';
import type { Metadata } from 'next';
import { Article, Scales, ShieldCheck } from '@phosphor-icons/react/dist/ssr';
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
    <DiscoveryShell className="space-y-14">
      <PageOpener
        title="Il voto della critica, con la firma"
        deck="Pubblico e critica restano separati: nessuna recensione anonima, nessun voto comprato."
      />

      <section aria-labelledby="how-heading" className="space-y-6">
        <h2 id="how-heading" className="om-headline text-3xl text-fg">
          Come funziona
        </h2>
        <ol className="om-stagger grid gap-x-8 gap-y-8 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="space-y-2 border-t border-line pt-5">
              <p className="flex items-center gap-3 text-fg-subtle">
                <span className="font-mono text-sm tabular-nums">{i + 1}</span>
                <step.icon aria-hidden="true" className="h-5 w-5" />
              </p>
              <h3 className="om-headline text-xl text-fg">{step.title}</h3>
              <p className="text-sm leading-relaxed text-fg-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start [&>*]:min-w-0 [&>*]:flex-1">
        <AccreditationPanel />
        <PendingRequestsPanel />
      </div>
    </DiscoveryShell>
  );
}
