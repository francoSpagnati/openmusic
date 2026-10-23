import React from 'react';
import type { UserProfileData } from '@openmusic/shared';
import { compactNumber } from '../format';

/** Listening "spine": four catalogue-style numbers. */
export function ProfileStats({ stats }: { stats: UserProfileData['stats'] }) {
  const items = [
    { label: 'Recensioni', value: compactNumber(stats.totalReviews) },
    { label: 'Ascolti verificati', value: compactNumber(stats.verifiedReviews) },
    { label: 'Scrobble', value: compactNumber(stats.totalScrobbles) },
    {
      label: 'Voto medio',
      value: stats.averageRating !== null ? `${stats.averageRating.toLocaleString('it')}★` : '—',
    },
  ];
  return (
    <dl className="grid grid-cols-2 border-b border-line sm:grid-cols-4">
      {items.map((item, i) => (
        <div
          key={item.label}
          className={`px-4 py-5 sm:px-6 ${i % 2 === 1 ? 'border-l border-line' : ''} ${i >= 2 ? 'border-t border-line sm:border-t-0' : ''} ${i === 2 ? 'sm:border-l' : ''}`}
        >
          <dt className="text-[13px] text-fg-subtle">{item.label}</dt>
          <dd className="mt-1 font-mono text-xl text-fg tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
