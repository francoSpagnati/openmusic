import React from 'react';
import type { CatalogRelease } from '@openmusic/shared';
import { ReleaseCard } from '../../components/ReleaseCard';
import { Skeleton } from '../../components/ui';

export const GRID_CLASSES = 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 xl:grid-cols-4';

export function ReleaseGrid({ releases, label }: { releases: CatalogRelease[]; label: string }) {
  return (
    <ul className={GRID_CLASSES} aria-label={label}>
      {releases.map((release, index) => (
        <li key={release.id}>
          <ReleaseCard release={release} priority={index < 4} />
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
        <div key={i} className="om-sleeve space-y-3 p-3 sm:p-4">
          <Skeleton shape="cover" />
          <Skeleton shape="text" lines={2} />
          <Skeleton className="h-7 w-2/3" />
        </div>
      ))}
    </div>
  );
}
