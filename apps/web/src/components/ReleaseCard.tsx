import React from 'react';
import Link from 'next/link';
import type { CatalogRelease } from '@openmusic/shared';
import { Card } from './ui';
import { DualScoreBadge } from './DualScoreBadge';
import { CoverArt } from './discovery/CoverArt';
import { ReleasePreviewButton } from './discovery/ReleasePreviewButton';
import { EditionChip } from './discovery/EditionChip';
import { workTitle } from './discovery/editions';
import { releaseEyebrow } from './discovery/format';

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
 * Record-sleeve card for a release. The title link is stretched over the whole card, while the
 * preview button sits above it so both stay separately focusable.
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
  return (
    <Card
      as="article"
      variant="sleeve"
      interactive
      padding="none"
      className="group flex h-full flex-col p-3 sm:p-4 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus"
    >
      <div className="relative">
        <CoverArt
          src={release.coverUrl}
          placeholderColor={release.dominantColor}
          alt=""
          sizes="(min-width: 1024px) 220px, (min-width: 640px) 33vw, 50vw"
          priority={priority}
          className="aspect-square w-full rounded-sm"
          imageClassName="transition-transform duration-slow ease-standard group-hover:scale-[1.03]"
        />
        <ReleasePreviewButton release={release} className="absolute bottom-2 right-2 z-raised" />
      </div>

      <div className="mt-3 flex flex-1 flex-col gap-1">
        <p className="om-eyebrow truncate">{releaseEyebrow(release)}</p>
        <Heading className="om-headline line-clamp-2 text-lg text-ink">
          <Link
            href={`/releases/${release.id}`}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-hover:text-accent"
          >
            {title}
            {title !== release.title && <span className="sr-only">, {release.editionLabel}</span>}
          </Link>
        </Heading>
        <p className="truncate text-sm text-ink-secondary">{release.artistName}</p>
        {(release.editionLabel || editionCount > 1) && (
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pt-0.5">
            {release.editionLabel && <EditionChip label={release.editionLabel} size="sm" />}
            {groupId && editionCount > 1 && (
              <Link
                href={`/albums/${groupId}`}
                className="relative z-raised rounded-xs font-mono text-[11px] font-semibold uppercase tracking-wider text-accent underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
              >
                {editionCount} edizioni
                <span className="sr-only"> di {title}</span>
              </Link>
            )}
          </div>
        )}
        <DualScoreBadge score={release} size="sm" className="mt-auto pt-3" />
      </div>
    </Card>
  );
};
