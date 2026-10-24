'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { WhoToFollow } from './web-core/WhoToFollow';
import { FriendsListening } from './web-core/shell/FriendsListening';
import { PeopleSearch } from './web-core/shell/PeopleSearch';
import { TrendingReleases } from './web-core/shell/TrendingReleases';

/**
 * Desktop right rail (xl+): people search, friends listening now, trending discs, who to follow.
 * Quiet on purpose: open sections divided by hairlines, no cards competing with the feed.
 */
export const RightSidebar: React.FC = () => {
  const { status } = useAuth();

  return (
    <aside
      aria-label="In evidenza"
      className="sticky top-0 hidden h-screen w-80 shrink-0 flex-col overflow-y-auto border-l border-line bg-canvas px-6 py-6 xl:flex"
    >
      <PeopleSearch />

      <div className="mt-6 divide-y divide-line">
        {status === 'authenticated' && (
          <section aria-labelledby="rail-friends" className="pb-6">
            <h2 id="rail-friends" className="mb-3 text-sm font-medium text-fg">
              In ascolto ora
            </h2>
            <FriendsListening />
          </section>
        )}

        <section aria-labelledby="rail-trending" className="py-6 first:pt-0">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h2 id="rail-trending" className="om-headline text-lg text-fg">
              Dischi del momento
            </h2>
            <Link href="/explore" className="om-link text-sm">
              Vedi tutti
            </Link>
          </div>
          <TrendingReleases />
        </section>

        <section aria-labelledby="rail-follow" className="pt-6">
          <h2 id="rail-follow" className="om-headline mb-4 text-lg text-fg">
            Chi seguire
          </h2>
          <WhoToFollow limit={3} />
        </section>
      </div>
    </aside>
  );
};
