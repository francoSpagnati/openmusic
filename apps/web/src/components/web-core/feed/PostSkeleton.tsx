import React from 'react';
import { Skeleton } from '@/components/ui';

/** Mirrors SocialPostCard's layout so nothing jumps when posts arrive. */
export function PostSkeleton() {
  return (
    <div className="border-b border-line px-4 py-5 sm:px-5">
      <div className="flex items-center gap-3">
        <Skeleton shape="circle" className="h-10 w-10" />
        <div className="w-40">
          <Skeleton shape="text" lines={2} />
        </div>
      </div>
      <Skeleton shape="text" lines={3} className="mt-4" />
      <div className="mt-4 flex gap-4">
        <Skeleton shape="rect" className="h-32 w-32 shrink-0" />
        <Skeleton shape="text" lines={3} className="mt-2" />
      </div>
    </div>
  );
}

export function FeedSkeleton({
  count = 3,
  label = 'Caricamento del feed…',
}: {
  count?: number;
  label?: string;
}) {
  return (
    <div aria-busy="true">
      <span className="sr-only" role="status">
        {label}
      </span>
      {Array.from({ length: count }, (_, i) => (
        <PostSkeleton key={i} />
      ))}
    </div>
  );
}
