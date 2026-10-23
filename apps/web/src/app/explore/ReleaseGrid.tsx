import React from 'react';
import type { CatalogRelease } from '@openmusic/shared';
import { ReleaseCard } from '../../components/ReleaseCard';
import { groupEditions } from '../../components/discovery/editions';
import { Skeleton } from '../../components/ui';

export const GRID_CLASSES =
  'grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-12 xl:grid-cols-4 xl:gap-x-8';

/**
 * Grid of release cards. With `foldEditions` (search results) editions of the same album become
 * one card with an "N edizioni" link to the album page, so a remaster and its original do not
 * look like duplicates.
 */
export function ReleaseGrid({
  releases,
  label,
  foldEditions = false,
}: {
  releases: CatalogRelease[];
  label: string;
  foldEditions?: boolean;
}) {
  const entries = foldEditions
    ? groupEditions(releases)
    : releases.map((release) => ({ release, editions: [release] }));
  return (
    <ul className={`om-stagger ${GRID_CLASSES}`} aria-label={label}>
      {entries.map(({ release, editions }, index) => (
        <li key={release.id}>
          <ReleaseCard release={release} priority={index < 4} editionCount={editions.length} />
        </li>
      ))}
    </ul>
  );
}

/** Mirrors ReleaseCard's shape so nothing jumps when data arrives. */
export function ReleaseGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div aria-busy="true" className={GRID_CLASSES}>
      <span className="sr-only">Caricamento dei dischi…</span>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton shape="cover" />
          <Skeleton shape="text" lines={2} />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}
