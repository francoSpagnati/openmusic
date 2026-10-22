import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowSquareOut } from '@phosphor-icons/react/dist/ssr';
import type { CatalogRelease } from '@openmusic/shared';
import { Badge } from '../../../components/ui';
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

/** Cover, title block and the dual score; tinted with the sleeve's dominant colour. */
export function ReleaseHero({ release }: { release: CatalogRelease }) {
  const tint = ambientTint(release.dominantColor);
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
  if (release.label) facts.push({ term: 'Etichetta', detail: release.label });
  const format = formatName(release.format);
  if (format) facts.push({ term: 'Formato', detail: format });
  const country = countryName(release.country);
  if (country) facts.push({ term: 'Paese', detail: country });
  if (trackCount) {
    facts.push({
      term: 'Durata',
      detail: (
        <span className="tabular-nums">
          {plural(trackCount, 'brano', 'brani')}
          {totalSeconds > 0 ? ` · ${formatClock(totalSeconds)}` : ''}
        </span>
      ),
    });
  }
  if (release.upc) facts.push({ term: 'Codice a barre', detail: release.upc });

  return (
    <header
      style={style}
      className="relative -mx-4 overflow-hidden px-4 pb-8 pt-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 bg-[linear-gradient(180deg,var(--release-tint,transparent),transparent_85%)] [[data-theme=light]_&]:bg-none"
    >
      <Link
        href="/explore"
        className="mb-6 inline-flex items-center gap-1.5 rounded-sm text-sm text-ink-secondary hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Torna al catalogo
      </Link>

      <div className="grid gap-6 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-10 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div className="relative mx-auto w-full max-w-[18rem] self-start md:mx-0">
          <CoverArt
            src={release.coverUrl}
            placeholderColor={release.dominantColor}
            alt={`Copertina di ${release.title} di ${release.artistName}`}
            sizes="(min-width: 1024px) 288px, (min-width: 768px) 240px, 80vw"
            priority
            className="aspect-square w-full rounded-sleeve shadow-om-lg"
          />
          <ReleasePreviewButton
            release={release}
            size="lg"
            className="absolute -bottom-4 right-4 z-raised"
          />
        </div>

        <div className="min-w-0 space-y-5">
          <div className="space-y-2">
            <p className="om-eyebrow">
              {RELEASE_TYPE_LABEL[release.releaseType]}
              {year && (
                <>
                  {' '}
                  · <span className="tabular-nums">{year}</span>
                </>
              )}
            </p>
            <h1 className="om-headline text-display-md text-ink lg:text-display-lg">
              {title}
              {title !== release.title && <span className="sr-only">, {release.editionLabel}</span>}
            </h1>
            <p className="om-deck text-xl">{release.artistName}</p>
          </div>

          {(release.editionLabel || hasEditions) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <EditionChip label={release.editionLabel} />
              {release.group && hasEditions && (
                <Link
                  href={`/albums/${release.group.id}`}
                  className="inline-flex items-center gap-1 rounded-sm text-sm font-semibold text-ink-secondary underline-offset-4 hover:text-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
                >
                  Tutte le {editionCount} edizioni e il voto complessivo
                  <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Link>
              )}
            </div>
          )}

          {(release.genres.length > 0 || release.releaseDate) && (
            <div className="flex flex-wrap items-center gap-2">
              {release.genres.map((genre) => (
                <Link
                  key={genre}
                  href={`/explore?genre=${encodeURIComponent(genre)}`}
                  className="rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
                >
                  <Badge tone="neutral" variant="outline" mono>
                    {genre}
                  </Badge>
                </Link>
              ))}
              {release.releaseDate && (
                <span className="font-mono text-xs text-ink-muted">
                  Uscito il{' '}
                  <time dateTime={release.releaseDate}>{formatDate(release.releaseDate)}</time>
                </span>
              )}
            </div>
          )}

          {facts.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
              {facts.map((fact) => (
                <div key={fact.term} className="min-w-0">
                  <dt className="om-eyebrow">{fact.term}</dt>
                  <dd className="mt-0.5 truncate font-mono text-xs text-ink">{fact.detail}</dd>
                </div>
              ))}
            </dl>
          )}

          <hr className="om-rule" />
          {hasEditions && (
            <p className="text-xs text-ink-muted">
              Voti di questa edizione. Le altre edizioni hanno i loro voti; quello complessivo è
              nella pagina dell’album.
            </p>
          )}
          <LiveDualScore />

          {(links.length > 0 || release.coverSource) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
              {links.length > 0 && (
                <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>Ascolta o verifica su</span>
                  {links.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-sm font-semibold text-ink-secondary underline-offset-4 hover:text-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
                    >
                      {link.label}
                      <ArrowSquareOut aria-hidden="true" className="h-3 w-3" />
                      <span className="sr-only"> (si apre in una nuova scheda)</span>
                    </a>
                  ))}
                </span>
              )}
              {release.coverSource && release.coverSource !== 'LOCAL' && (
                <span>Copertina: {CATALOG_SOURCE_LABEL[release.coverSource]}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
