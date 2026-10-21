'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react';
import { useAuth } from '@/lib/auth';
import { Card } from '@/components/ui';
import { WhoToFollow } from './web-core/WhoToFollow';
import { FriendsListening } from './web-core/shell/FriendsListening';
import { PeopleSearch } from './web-core/shell/PeopleSearch';
import { TrendingReleases } from './web-core/shell/TrendingReleases';

/** Desktop right rail (xl+): people search, friends listening now, trending discs, who to follow. */
export const RightSidebar: React.FC = () => {
  const { status } = useAuth();

  return (
    <aside
      aria-label="In evidenza"
      className="sticky top-0 hidden h-screen w-80 shrink-0 flex-col gap-5 overflow-y-auto border-l border-line bg-canvas p-4 xl:flex"
    >
      <PeopleSearch />

      {status === 'authenticated' && (
        <Card as="section" aria-labelledby="rail-friends" padding="sm" className="p-4">
          <h2 id="rail-friends" className="om-eyebrow mb-3">
            In ascolto ora
          </h2>
          <FriendsListening />
        </Card>
      )}

      <Card as="section" aria-labelledby="rail-trending" padding="sm" className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="rail-trending" className="om-headline text-lg text-ink">
            Dischi del momento
          </h2>
          <Link
            href="/explore"
            className="inline-flex items-center gap-1 font-mono text-xs text-accent hover:underline"
          >
            Tutti <ArrowRight aria-hidden="true" />
          </Link>
        </div>
        <TrendingReleases />
      </Card>

      <Card as="section" aria-labelledby="rail-follow" padding="sm" className="p-4">
        <h2 id="rail-follow" className="om-headline mb-3 text-lg text-ink">
          Chi seguire
        </h2>
        <WhoToFollow limit={3} />
      </Card>
    </aside>
  );
};
