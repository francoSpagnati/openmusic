import React from 'react';
import Link from 'next/link';
import { GithubLogo } from '@phosphor-icons/react/dist/ssr';

const EXPLORE_LINKS = [
  { href: '/explore', label: 'Esplora le uscite' },
  { href: '/critics', label: 'Critica accreditata' },
  { href: '/videos', label: 'Video saggi' },
  { href: '/reels', label: 'Reels di scoperta' },
];

const ACCOUNT_LINKS = [
  { href: '/profile', label: 'Il tuo profilo' },
  { href: '/settings', label: 'Impostazioni e privacy' },
  { href: '/auth?mode=register', label: 'Crea un account' },
];

/** Colophon, styled like the back page of a music magazine. */
export const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 w-full border-t border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="space-y-3 md:col-span-2">
            <p className="om-headline text-2xl text-ink">OpenMusic</p>
            <p className="om-deck max-w-md text-ink-secondary">
              Un negozio di dischi che stampa anche una rivista: niente algoritmi della dipendenza,
              solo ascolti condivisi, voto del pubblico e della critica.
            </p>
          </div>

          <nav aria-labelledby="footer-explore">
            <h2 id="footer-explore" className="om-eyebrow mb-3">
              Esplora
            </h2>
            <ul className="space-y-2 text-sm">
              {EXPLORE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-ink-secondary hover:text-ink hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-account">
            <h2 id="footer-account" className="om-eyebrow mb-3">
              Account
            </h2>
            <ul className="space-y-2 text-sm">
              {ACCOUNT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-ink-secondary hover:text-ink hover:underline"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href="https://github.com/francoSpagnati/openmusic"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-ink-secondary hover:text-ink hover:underline"
                >
                  <GithubLogo aria-hidden="true" className="h-4 w-4" />
                  Codice sorgente
                  <span className="sr-only">(si apre in una nuova scheda)</span>
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <hr className="om-rule mt-10" />
        <div className="flex flex-col gap-2 pt-4 font-mono text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © <span className="tabular-nums">{year}</span> OpenMusic Community · Licenza MIT
          </p>
          <p>Anteprime di 30 secondi · Voti da 0,5 a 5 stelle</p>
        </div>
      </div>
    </footer>
  );
};
