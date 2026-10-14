'use client';

import React from 'react';
import Link from 'next/link';
import { Disc, GithubLogo, ShieldCheck, Heart, Sparkle } from '@phosphor-icons/react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full border-t border-om-border bg-om-card/60 mt-20">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Colonna 1: Manifesto */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-om-card border border-om-border">
                <Disc weight="duotone" className="h-5 w-5 text-om-amber" />
              </div>
              <span className="font-editorial text-lg font-bold text-om-text">OpenMusic</span>
            </div>
            <p className="text-sm text-om-secondary leading-relaxed max-w-md">
              Il social network musicale open-source e tattile. Niente algoritmi di dipendenza o feed rumorosi: solo
              condivisione sincera, recensioni a doppio punteggio (Critica & Pubblico) e ascolto in tempo reale.
            </p>
            <div className="flex items-center gap-2 text-xs text-om-muted font-mono">
              <ShieldCheck className="h-4 w-4 text-om-fresh" />
              <span>Conforme alle 10 Euristiche di Nielsen & Standard Anti-AI-Slop</span>
            </div>
          </div>

          {/* Colonna 2: Navigazione */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-wider text-om-amber font-semibold">
              Esplorazione
            </h4>
            <ul className="space-y-2 text-sm text-om-secondary">
              <li>
                <Link href="/#releases" className="hover:text-om-text transition-colors">
                  Ultime Releases
                </Link>
              </li>
              <li>
                <Link href="/critics" className="hover:text-om-text transition-colors">
                  Accredito Critica & Webzine
                </Link>
              </li>
              <li>
                <Link href="/videos" className="hover:text-om-text transition-colors">
                  Video-Saggi Musicali
                </Link>
              </li>
              <li>
                <Link href="/#roulette" className="hover:text-om-text transition-colors">
                  Roulette dei Generi
                </Link>
              </li>
            </ul>
          </div>

          {/* Colonna 3: Open Source & Community */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono uppercase tracking-wider text-om-amber font-semibold">
              Ecosistema
            </h4>
            <ul className="space-y-2 text-sm text-om-secondary">
              <li>
                <a
                  href="https://github.com/francoSpagnati/openmusic"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-om-text transition-colors"
                >
                  <GithubLogo className="h-4 w-4" /> GitHub Repository
                </a>
              </li>
              <li>
                <span className="text-xs font-mono text-om-muted">Licenza MIT Open-Source</span>
              </li>
              <li>
                <span className="text-xs font-mono text-om-muted">Monorepo: Expo + Next.js + Fastify</span>
              </li>
              <li>
                <span className="text-xs font-mono text-om-muted">Preview Audio via ISRC Fallback</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-6 border-t border-om-border/50 flex flex-col sm:flex-row items-center justify-between text-xs text-om-muted font-mono gap-4">
          <p>© {new Date().getFullYear()} OpenMusic Community. Costruito con rispetto per la musica analogica.</p>
          <div className="flex items-center gap-2">
            <span>Ascolto verificato con</span>
            <Heart weight="fill" className="h-3.5 w-3.5 text-om-amber inline" />
            <span>per veri amanti del vinile</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
