'use client';

import React from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ErrorState, ScoreBadge, Skeleton } from '@/components/ui';
import { CoverArt } from '@/components/discovery/CoverArt';
import { useApiResource } from '../useApiResource';
import { errorMessage, yearOf } from '../format';

/** Most reviewed releases in the catalogue (`sort=popular`). */
export function TrendingReleases({ limit = 5 }: { limit?: number }) {
  const releases = useApiResource(`trending:${limit}`, () =>
    api.catalog.browse({ sort: 'popular', limit })
  );

  if (releases.status === 'loading' || releases.status === 'idle') {
    return (
      <ul aria-busy="true" className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <li key={i} className="flex items-center gap-3">
            <Skeleton shape="rect" className="h-12 w-12 shrink-0" />
            <Skeleton shape="text" lines={2} className="flex-1" />
          </li>
        ))}
      </ul>
    );
  }

  if (releases.status === 'error') {
    return (
      <ErrorState
        variant="inline"
        title="Classifica non disponibile"
        description={errorMessage(releases.error)}
        onRetry={releases.reload}
      />
    );
  }

  const items = releases.data?.items ?? [];
  if (items.length === 0)
    return <p className="text-sm text-ink-muted">Il catalogo è ancora vuoto.</p>;

  return (
    <ol className="space-y-3">
      {items.map((release, index) => {
        const year = yearOf(release.releaseDate ?? null);
        return (
          <li key={release.id} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="w-4 shrink-0 font-mono text-xs text-ink-muted tabular-nums"
            >
              {index + 1}
            </span>
            <CoverArt
              src={release.coverUrl}
              placeholderColor={release.dominantColor}
              alt=""
              sizes="48px"
              className="h-12 w-12 shrink-0 rounded-xs ring-1 ring-line"
            />
            <div className="min-w-0 flex-1">
              <Link
                href={`/releases/${release.id}`}
                className="block truncate text-sm font-semibold text-ink hover:underline"
              >
                {release.title}
              </Link>
              <p className="truncate text-xs text-ink-secondary">
                {release.artistName}
                {year && <span className="font-mono tabular-nums"> · {year}</span>}
              </p>
            </div>
            {release.audienceCount > 0 && (
              <ScoreBadge
                kind="audience"
                percentage={release.audienceFreshPct ?? null}
                totalReviews={release.audienceCount}
                size="sm"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
