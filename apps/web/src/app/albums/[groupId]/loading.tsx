import React from 'react';
import { Skeleton } from '../../../components/ui';
import { DiscoveryShell } from '../../../components/discovery/DiscoveryShell';

export default function AlbumLoading() {
  return (
    <DiscoveryShell className="space-y-10">
      <div aria-busy="true" className="space-y-10">
        <span className="sr-only">Caricamento dell’album…</span>
        <div className="grid gap-6 md:grid-cols-[13rem_1fr] md:gap-10 lg:grid-cols-[16rem_1fr]">
          <Skeleton shape="cover" className="mx-auto max-w-[16rem] md:mx-0" />
          <div className="space-y-4">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-6 w-1/3" />
            <div className="flex gap-4 pt-6">
              <Skeleton className="h-16 w-40" />
              <Skeleton className="h-16 w-40" />
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      </div>
    </DiscoveryShell>
  );
}
