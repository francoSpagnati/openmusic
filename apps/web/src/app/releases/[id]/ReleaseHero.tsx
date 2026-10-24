import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowSquareOut } from '@phosphor-icons/react/dist/ssr';
import type { CatalogRelease } from '@openmusic/shared';
import { CoverArt } from '../../../components/discovery/CoverArt';
import { ReleasePreviewButton } from '../../../components/discovery/ReleasePreviewButton';
import { ambientTint } from '../../../components/discovery/ambientTint';
import { EditionChip } from '../../../components/discovery/EditionChip';
import { countryName, formatName, workTitle } from '../../../components/discovery/editions';
import {
  CATALOG_SOURCE_LABEL,
  RELEASE_TYPE_LABEL,
  formatClock,
  formatDate,
  plural,
  releaseYear,
} from '../../../components/discovery/format';
import { LiveDualScore } from './LiveDualScore';

/** Public pages of the same release in the open databases it was matched with. */
function externalLinks(release: CatalogRelease): Array<{ label: string; href: string }> {
  const ids = release.externalIds ?? {};
  const links: Array<{ label: string; href: string }> = [];
  const safe = (id: string | null | undefined) =>
    id && /^[A-Za-z0-9-]{1,64}$/.test(id) ? id : null;
  const deezer = safe(ids.deezer);
  const musicbrainz = safe(ids.musicbrainz);
  const itunes = safe(ids.itunes);
  const spotify = safe(ids.spotify);
  if (spotify) links.push({ label: 'Spotify', href: `https://open.spotify.com/album/${spotify}` });
  if (deezer) links.push({ label: 'Deezer', href: `https://www.deezer.com/album/${deezer}` });
  if (itunes) links.push({ label: 'Apple Music', href: `https://music.apple.com/album/${itunes}` });
  if (musicbrainz) {
    links.push({ label: 'MusicBrainz', href: `https://musicbrainz.org/release/${musicbrainz}` });
  }
  return links;
}

/**
 * Editorial header: the sleeve is the colour of the page. A faint tint of its dominant colour
 * survives only in the dark theme (ADR-015); in light the paper stays plain.
 */
export function ReleaseHero({ release }: { release: CatalogRelease }) {
  const tint = ambientTint(release.dominantColor, 0.25);
  const year = releaseYear(release.releaseDate);
  const style = tint ? ({ '--release-tint': tint } as React.CSSProperties) : undefined;
  const tracks = release.tracks ?? [];
  const trackCount = tracks.length > 0 ? tracks.length : (release.trackCount ?? null);
  const totalSeconds = tracks.reduce((sum, t) => sum + t.durationMs, 0) / 1000;
  const links = externalLinks(release);
  const editionCount = (release.otherEditions?.length ?? 0) + 1;
  const hasEditions = editionCount > 1;
  const title = workTitle(release);
  const facts: Array<{ term: string; detail: React.ReactNode }> = [];
  if (release.releaseDate) {
    facts.push({
      term: 'Uscita',
      detail: <time dateTime={release.releaseDate}>{formatDate(release.releaseDate)}</time>,
    });
  }
  if (release.label) facts.push({ term: 'Etichetta', detail: release.label });
  const format = formatName(release.format);
  if (format) facts.push({ term: 'Formato', detail: format });
  const country = countryName(release.country);
  if (country) facts.push({ term: 'Paese', detail: country });
  if (trackCount) {
    facts.push({
      term: 'Durata',
      detail: (
        <>
          {plural(trackCount, 'brano', 'brani')}
          {totalSeconds > 0 && (
            <>
              , <span className="font-mono tabular-nums">{formatClock(totalSeconds)}</span>
            </>
          )}
        </>
      ),
    });
  }
  if (release.upc) {
    facts.push({
      term: 'Codice a barre',
      detail: <span className="font-mono tabular-nums">{release.upc}</span>,
    });
  }

  return (
    <header
      style={style}
      className="relative -mx-4 px-4 pb-4 pt-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 dark:bg-[linear-gradient(180deg,var(--release-tint,transparent),transparent_70%)]"
    >
      <Link
        href="/explore"
        className="mb-8 inline-flex items-center gap-1.5 rounded-sm text-sm text-fg-muted transition-colors duration-fast hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Torna al catalogo
      </Link>

      <div className="grid gap-8 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:gap-12 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
        <div className="relative mx-auto w-full max-w-[20rem] self-start md:mx-0">
          <CoverArt
            src={release.coverUrl}
            placeholderColor={release.dominantColor}
            alt={`Copertina di ${release.title} di ${release.artistName}`}
            sizes="(min-width: 1024px) 320px, (min-width: 768px) 256px, 80vw"
            priority
            framed
            className="aspect-square w-full rounded-md"
          />
          <ReleasePreviewButton
            release={release}
            size="lg"
            className="absolute bottom-3 right-3 z-raised"
          />
        </div>

        <div className="min-w-0 space-y-7">
          <div className="space-y-3">
            <p className="om-eyebrow">
              {RELEASE_TYPE_LABEL[release.releaseType]}
              {year && (
                <>
                  {' del '}
                  <span className="font-mono tabular-nums">{year}</span>
                </>
              )}
            </p>
            <h1 className="om-headline text-balance text-display-md text-fg lg:text-display-lg">
              {title}
              {title !== release.title && <span className="sr-only">, {release.editionLabel}</span>}
            </h1>
            <p className="om-deck text-xl sm:text-2xl">{release.artistName}</p>
          </div>

          {(release.editionLabel || hasEditions) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <EditionChip label={release.editionLabel} />
              {release.group && hasEditions && (
                <Link
                  href={`/albums/${release.group.id}`}
                  className="om-link inline-flex items-center gap-1 rounded-sm text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
                >
                  Tutte le {editionCount} edizioni e il voto complessivo
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              )}
            </div>
          )}

          {release.genres.length > 0 && (
            <ul aria-label="Generi" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {release.genres.map((genre) => (
                <li key={genre}>
                  <Link
                    href={`/explore?genre=${encodeURIComponent(genre)}`}
                    className="rounded-sm text-fg-muted underline decoration-line-strong/60 underline-offset-4 transition-colors duration-fast hover:text-fg hover:decoration-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
                  >
                    {genre}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {facts.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-8 gap-y-4 border-y border-line py-5 sm:grid-cols-3">
              {facts.map((fact) => (
                <div key={fact.term} className="min-w-0">
                  <dt className="om-eyebrow">{fact.term}</dt>
                  <dd className="mt-0.5 truncate text-sm text-fg">{fact.detail}</dd>
                </div>
              ))}
            </dl>
          )}

          {hasEditions && (
            <p className="max-w-prose text-sm text-fg-subtle">
              Voti di questa edizione. Le altre edizioni hanno i loro voti; quello complessivo è
              nella pagina dell’album.
            </p>
          )}
          <LiveDualScore />

          {(links.length > 0 || release.coverSource) && (
            <div className="flex flex-col gap-1 text-xs text-fg-subtle">
              {links.length > 0 && (
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>Ascolta o verifica su</span>
                  {links.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-sm font-medium text-fg-muted underline-offset-4 hover:text-fg hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
                    >
                      {link.label}
                      <ArrowSquareOut aria-hidden="true" className="h-3 w-3" />
                      <span className="sr-only"> (si apre in una nuova scheda)</span>
                    </a>
                  ))}
                </p>
              )}
              {release.coverSource && release.coverSource !== 'LOCAL' && (
                <p>Copertina: {CATALOG_SOURCE_LABEL[release.coverSource]}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
