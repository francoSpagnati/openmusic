import React from 'react';
import Link from 'next/link';
import type { CatalogRelease } from '@openmusic/shared';
import { DualScoreBadge } from './DualScoreBadge';
import { CoverArt } from './discovery/CoverArt';
import { ReleasePreviewButton } from './discovery/ReleasePreviewButton';
import { EditionChip } from './discovery/EditionChip';
import { workTitle } from './discovery/editions';
import { RELEASE_TYPE_LABEL, releaseYear } from './discovery/format';

interface ReleaseCardProps {
  release: CatalogRelease;
  /** Eager-load the cover (first row above the fold). */
  priority?: boolean;
  headingLevel?: 2 | 3;
  /**
   * ADR-012: how many editions of the same album the surrounding list folded into this card
   * (search results). Above 1 the card links to the album page that lists them all.
   */
  editionCount?: number;
}

/**
 * A release as it would sit in a record-review magazine: the sleeve, then the title in the serif,
 * the artist and quiet metadata. No box around it; hover only dims the sleeve slightly and
 * underlines the title. The title link is stretched over the whole card, while the preview button
 * sits above it so both stay separately focusable.
 */
export const ReleaseCard: React.FC<ReleaseCardProps> = ({
  release,
  priority,
  headingLevel = 3,
  editionCount = 1,
}) => {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const title = workTitle(release);
  const groupId = release.group?.id;
  const year = releaseYear(release.releaseDate);
  const genre = release.genres[0];
  return (
    <article className="group relative flex h-full flex-col rounded-sm focus-within:outline focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-focus">
      <div className="relative">
        <CoverArt
          src={release.coverUrl}
          placeholderColor={release.dominantColor}
          alt=""
          sizes="(min-width: 1280px) 240px, (min-width: 640px) 30vw, 45vw"
          priority={priority}
          framed
          className="aspect-square w-full rounded-sm transition-opacity duration-base ease-out group-hover:opacity-90"
        />
        <ReleasePreviewButton
          release={release}
          className="absolute bottom-2 right-2 z-raised transition-opacity duration-base ease-out [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:focus-visible:opacity-100 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100"
        />
      </div>

      <div className="mt-3 flex flex-1 flex-col gap-0.5">
        <Heading className="om-headline line-clamp-2 text-xl leading-tight text-fg">
          <Link
            href={`/releases/${release.id}`}
            className="decoration-1 underline-offset-4 after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-hover:underline"
          >
            {title}
            {title !== release.title && <span className="sr-only">, {release.editionLabel}</span>}
          </Link>
        </Heading>
        <p className="truncate text-sm text-fg-muted">{release.artistName}</p>
        <p className="truncate text-xs text-fg-subtle">
          {RELEASE_TYPE_LABEL[release.releaseType]}
          {year && (
            <>
              {' '}
              <span className="font-mono tabular-nums">{year}</span>
            </>
          )}
          {genre && <>, {genre}</>}
        </p>
        {(release.editionLabel || editionCount > 1) && (
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 pt-1.5">
            {release.editionLabel && <EditionChip label={release.editionLabel} size="sm" />}
            {groupId && editionCount > 1 && (
              <Link
                href={`/albums/${groupId}`}
                className="om-link relative z-raised rounded-xs text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
              >
                {editionCount} edizioni
                <span className="sr-only"> di {title}</span>
              </Link>
            )}
          </div>
        )}
        <DualScoreBadge score={release} size="sm" className="mt-auto pt-3" />
      </div>
    </article>
  );
};
