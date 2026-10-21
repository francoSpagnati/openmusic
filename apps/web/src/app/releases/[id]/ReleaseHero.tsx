import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from '@phosphor-icons/react/dist/ssr';
import type { CatalogRelease } from '@openmusic/shared';
import { Badge } from '../../../components/ui';
import { CoverArt } from '../../../components/discovery/CoverArt';
import { ReleasePreviewButton } from '../../../components/discovery/ReleasePreviewButton';
import { ambientTint } from '../../../components/discovery/ambientTint';
import { RELEASE_TYPE_LABEL, formatDate, releaseYear } from '../../../components/discovery/format';
import { LiveDualScore } from './LiveDualScore';

/** Cover, title block and the dual score; tinted with the sleeve's dominant colour. */
export function ReleaseHero({ release }: { release: CatalogRelease }) {
  const tint = ambientTint(release.dominantColor);
  const year = releaseYear(release.releaseDate);
  const style = tint ? ({ '--release-tint': tint } as React.CSSProperties) : undefined;

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
              {release.title}
            </h1>
            <p className="om-deck text-xl">{release.artistName}</p>
          </div>

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

          <hr className="om-rule" />
          <LiveDualScore />
        </div>
      </div>
    </header>
  );
}
