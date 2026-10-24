import React from 'react';
import { Skeleton } from '../../../components/ui';
import { DiscoveryShell } from '../../../components/discovery/DiscoveryShell';

export default function ReleaseLoading() {
  return (
    <DiscoveryShell className="space-y-16">
      <div aria-busy="true" className="space-y-16 pt-12">
        <span className="sr-only">Caricamento del disco…</span>
        <div className="grid gap-8 md:grid-cols-[16rem_1fr] md:gap-12 lg:grid-cols-[20rem_1fr]">
          <Skeleton shape="cover" className="mx-auto max-w-[20rem] md:mx-0" />
          <div className="space-y-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-14 w-3/4" />
            <Skeleton className="h-6 w-1/3" />
            <div className="flex gap-12 pt-8">
              <Skeleton className="h-14 w-28" />
              <Skeleton className="h-14 w-28" />
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton shape="text" lines={6} />
        </div>
        <div className="max-w-prose">
          <Skeleton shape="text" lines={6} />
        </div>
      </div>
    </DiscoveryShell>
  );
}
