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
    <footer className="mt-24 w-full border-t border-line bg-canvas">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-3 md:col-span-2">
            <p className="om-headline text-xl text-fg">OpenMusic</p>
            <p className="max-w-sm text-sm text-fg-muted">
              Un negozio di dischi che stampa anche una rivista: niente algoritmi della dipendenza,
              solo ascolti condivisi, voto del pubblico e della critica.
            </p>
          </div>

          <nav aria-labelledby="footer-explore">
            <h2 id="footer-explore" className="mb-3 text-sm font-medium text-fg">
              Esplora
            </h2>
            <ul className="space-y-2 text-sm">
              {EXPLORE_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-fg-muted hover:text-fg hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-account">
            <h2 id="footer-account" className="mb-3 text-sm font-medium text-fg">
              Account
            </h2>
            <ul className="space-y-2 text-sm">
              {ACCOUNT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-fg-muted hover:text-fg hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href="https://github.com/francoSpagnati/openmusic"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-fg-muted hover:text-fg hover:underline"
                >
                  <GithubLogo aria-hidden="true" className="h-4 w-4" />
                  Codice sorgente
                  <span className="sr-only">(si apre in una nuova scheda)</span>
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <hr className="om-rule mt-12" />
        <div className="flex flex-col gap-1 pt-5 text-xs text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>
            © <span className="font-mono tabular-nums">{year}</span> OpenMusic Community, licenza
            MIT
          </p>
          <p>Anteprime di 30 secondi, voti da 0,5 a 5 stelle</p>
        </div>
      </div>
    </footer>
  );
};
