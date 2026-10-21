import React from 'react';
import { Skeleton } from '../../../components/ui';
import { DiscoveryShell } from '../../../components/discovery/DiscoveryShell';

export default function ReleaseLoading() {
  return (
    <DiscoveryShell className="space-y-10">
      <div aria-busy="true" className="space-y-10">
        <span className="sr-only">Caricamento del disco…</span>
        <div className="grid gap-6 md:grid-cols-[15rem_1fr] md:gap-10 lg:grid-cols-[18rem_1fr]">
          <Skeleton shape="cover" className="mx-auto max-w-[18rem] md:mx-0" />
          <div className="space-y-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-6 w-1/3" />
            <div className="flex gap-4 pt-6">
              <Skeleton className="h-16 w-40" />
              <Skeleton className="h-16 w-40" />
            </div>
          </div>
        </div>
        <Skeleton className="h-72" />
        <div className="grid gap-10 xl:grid-cols-2">
          <Skeleton shape="text" lines={6} />
          <Skeleton shape="text" lines={6} />
        </div>
      </div>
    </DiscoveryShell>
  );
}
