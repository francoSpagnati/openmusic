'use client';

import React, { useState } from 'react';
import {
  SealCheck,
  Newspaper,
  CheckCircle,
  PaperPlaneTilt,
  ArrowSquareOut,
  ShieldCheck,
  Article,
} from '@phosphor-icons/react';
import { Sidebar } from '../../components/Sidebar';
import { ShareSongModal } from '../../components/ShareSongModal';

const ACCREDITED_OUTLETS = [
  { name: 'Pitchfork', country: 'US', focus: 'Indie / Electronic / Hip-Hop', reviewsCount: 1420 },
  { name: 'OndaRock', country: 'IT', focus: 'Rock d\'autore, Psichedelia, Wave', reviewsCount: 980 },
  { name: 'Stereogum', country: 'US', focus: 'Alternative / Pop / New Releases', reviewsCount: 1100 },
  { name: 'The Needle Drop', country: 'US', focus: 'YouTube Video Reviews & Score 1..10', reviewsCount: 650 },
  { name: 'Rumore', country: 'IT', focus: 'Underground, Post-Punk, Noise', reviewsCount: 430 },
  { name: 'Blow Up', country: 'IT', focus: 'Sperimentale, Ambient, Jazz avant-garde', reviewsCount: 510 },
];

export default function CriticsPage() {
  const [outletName, setOutletName] = useState('');
  const [criticName, setCriticName] = useState('');
  const [portfolioUrl, setPortfolioUrl] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (outletName && criticName && portfolioUrl) {
      setSubmitted(true);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Navigation Sidebar */}
        <aside className="hidden lg:block lg:col-span-3">
          <Sidebar onOpenCreatePost={() => setIsShareModalOpen(true)} />
        </aside>

        {/* Main Content Area */}
        <main className="lg:col-span-9 space-y-12">
          {/* Header */}
      <section className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-om-fresh/40 bg-om-fresh/10 px-3.5 py-1 text-xs font-mono text-om-fresh">
          <SealCheck weight="duotone" className="h-4 w-4" />
          <span>Portale Stampa & Giornalismo Musicale</span>
        </div>

        <h1 className="font-editorial text-4xl sm:text-5xl font-bold text-om-text leading-tight">
          Il Rotten Tomatoes che mancava{' '}
          <span className="text-om-fresh italic font-normal">alla musica.</span>
        </h1>

        <p className="text-base text-om-secondary leading-relaxed">
          OpenMusic separa rigorosamente il Voto del Pubblico da quello della Critica accreditata.
          Nessuna recensione comprata, niente bot o recensioni anonime: solo firme editoriali verificate.
        </p>
      </section>

      {/* How it works grid */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="rounded-xl border border-om-border bg-om-card p-6 space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-om-interactive border border-om-border text-om-fresh">
            <ShieldCheck size={22} weight="duotone" />
          </div>
          <h3 className="font-editorial text-lg font-bold text-om-text">
            1. Accredito Ufficiale
          </h3>
          <p className="text-xs text-om-secondary leading-relaxed">
            I giornalisti e i redattori inviano il link alla propria testata e al portfolio di articoli.
            Il team editoriale verifica l'autenticità prima di rilasciare il badge verified.
          </p>
        </div>

        <div className="rounded-xl border border-om-border bg-om-card p-6 space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-om-interactive border border-om-border text-om-amber">
            <Article size={22} weight="duotone" />
          </div>
          <h3 className="font-editorial text-lg font-bold text-om-text">
            2. Link alla Fonte Originale
          </h3>
          <p className="text-xs text-om-secondary leading-relaxed">
            Ogni recensione della critica ospita un estratto sintetico (pull quote) e reindirizza con un
            link diretto all'articolo completo sul sito della testata, valorizzando il giornalismo.
          </p>
        </div>

        <div className="rounded-xl border border-om-border bg-om-card p-6 space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-om-interactive border border-om-border text-om-fresh">
            <SealCheck size={22} weight="duotone" />
          </div>
          <h3 className="font-editorial text-lg font-bold text-om-text">
            3. Soglia Fresh / Rotten
          </h3>
          <p className="text-xs text-om-secondary leading-relaxed">
            Le valutazioni con punteggio $\ge 70\%$ ($\ge 3.5/5.0$) ottengono lo stato Fresh verde,
            mentre i voti inferiori al 70% sono Rotten. Il contatore calcola la percentuale reale.
          </p>
        </div>
      </section>

      {/* Accredited Outlets Showcase */}
      <section className="space-y-6">
        <div>
          <h2 className="font-editorial text-2xl font-bold text-om-text">
            Testate Accreditate
          </h2>
          <p className="text-xs text-om-secondary mt-1">
            Alcune delle pubblicazioni e webzine che alimentano il Critic Score di OpenMusic.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ACCREDITED_OUTLETS.map((outlet) => (
            <div
              key={outlet.name}
              className="rounded-lg border border-om-border bg-om-card p-4 flex items-center justify-between hover:border-om-fresh/40 transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-editorial font-bold text-om-text text-base">
                    {outlet.name}
                  </h4>
                  <span className="text-[10px] font-mono text-om-muted border border-om-border px-1.5 py-0.2 rounded">
                    {outlet.country}
                  </span>
                </div>
                <p className="text-xs text-om-secondary mt-0.5">{outlet.focus}</p>
              </div>

              <div className="text-right">
                <span className="font-mono text-xs font-bold text-om-fresh tabular-nums">
                  {outlet.reviewsCount}
                </span>
                <p className="text-[10px] font-mono text-om-muted">recensioni</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Accreditation Application Form */}
      <section className="rounded-2xl border border-om-border bg-om-card p-8 sm:p-10 max-w-3xl mx-auto shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-om-border pb-4 mb-6">
          <Newspaper weight="duotone" className="h-6 w-6 text-om-fresh" />
          <h2 className="font-editorial text-2xl font-bold text-om-text">
            Richiesta di Accredito Giornalistico
          </h2>
        </div>

        {submitted ? (
          <div className="rounded-xl border border-om-fresh/40 bg-om-fresh/10 p-6 text-center space-y-3">
            <CheckCircle weight="fill" className="h-12 w-12 text-om-fresh mx-auto" />
            <h3 className="font-editorial text-xl font-bold text-om-text">
              Richiesta Inviata con Successo!
            </h3>
            <p className="text-xs text-om-secondary max-w-md mx-auto">
              Il team di moderazione verificherà la tua testata ({outletName}) e ti invierà la conferma
              di accredito con badge verificato entro 48 ore lavorative.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-om-secondary mb-1">
                  Nome Testata / Webzine *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Es. OndaRock, Pitchfork, Rolling Stone"
                  value={outletName}
                  onChange={(e) => setOutletName(e.target.value)}
                  className="w-full rounded-lg border border-om-border bg-om-bg px-3.5 py-2.5 text-sm text-om-text placeholder-om-muted focus:border-om-fresh focus:outline-none font-sans"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-om-secondary mb-1">
                  Nome e Cognome Critico / Giornalista *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Es. Marco Rossi"
                  value={criticName}
                  onChange={(e) => setCriticName(e.target.value)}
                  className="w-full rounded-lg border border-om-border bg-om-bg px-3.5 py-2.5 text-sm text-om-text placeholder-om-muted focus:border-om-fresh focus:outline-none font-sans"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-om-secondary mb-1">
                Link Portfolio / Articoli Pubblicati *
              </label>
              <input
                type="url"
                required
                placeholder="https://tuawebzine.it/autore/marco-rossi"
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
                className="w-full rounded-lg border border-om-border bg-om-bg px-3.5 py-2.5 text-sm text-om-text placeholder-om-muted focus:border-om-fresh focus:outline-none font-sans"
              />
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-om-fresh hover:bg-om-fresh/90 text-om-bg font-sans font-semibold py-3 text-sm transition-all shadow-sm hover:scale-[1.01]"
            >
              <PaperPlaneTilt weight="bold" className="h-4 w-4" />
              <span>Invia Candidatura per Accredito</span>
            </button>
          </form>
        )}
      </section>
        </main>
      </div>

      <ShareSongModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />
    </div>
  );
}
