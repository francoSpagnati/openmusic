'use client';

import React from 'react';
import type { UserSummary } from '@openmusic/shared';
import { api } from '@/lib/api';
import { Dialog, EmptyState, ErrorState, Skeleton } from '@/components/ui';
import { FollowButton } from '../FollowButton';
import { LoadMore } from '../LoadMore';
import { UserIdentity } from '../UserIdentity';
import { errorMessage } from '../format';
import { usePagedList } from '../usePagedList';

export type FollowListKind = 'followers' | 'following';

/** Followers / following of a user, paginated, inside a modal dialog. */
export function FollowListDialog({
  userId,
  name,
  kind,
  onClose,
}: {
  userId: string;
  name: string;
  kind: FollowListKind | null;
  onClose: () => void;
}) {
  const list = usePagedList<UserSummary>(kind ? `${kind}:${userId}` : null, (cursor) =>
    kind === 'following'
      ? api.users.following(userId, { cursor, limit: 20 })
      : api.users.followers(userId, { cursor, limit: 20 })
  );

  const title = kind === 'following' ? `Persone seguite da ${name}` : `Follower di ${name}`;

  return (
    <Dialog open={kind !== null} onClose={onClose} title={title} size="sm" closeLabel="Chiudi">
      {list.status === 'loading' || list.status === 'idle' ? (
        <ul aria-busy="true" className="space-y-3">
          <li className="sr-only" role="status">
            Caricamento…
          </li>
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="flex items-center gap-3">
              <Skeleton shape="circle" className="h-10 w-10" />
              <Skeleton shape="text" lines={2} className="flex-1" />
            </li>
          ))}
        </ul>
      ) : list.status === 'error' ? (
        <ErrorState
          variant="inline"
          title="Elenco non disponibile"
          description={errorMessage(list.error)}
          onRetry={list.reload}
        />
      ) : list.items.length === 0 ? (
        <EmptyState
          size="compact"
          title={kind === 'following' ? 'Non segue ancora nessuno' : 'Ancora nessun follower'}
        />
      ) : (
        <>
          <ul className="space-y-3">
            {list.items.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-2">
                <UserIdentity user={u} size="sm" />
                <FollowButton userId={u.id} username={u.username} isFollowing={u.isFollowedByMe} />
              </li>
            ))}
          </ul>
          <LoadMore
            hasMore={list.hasMore}
            loading={list.loadingMore}
            error={list.moreError}
            onLoadMore={list.loadMore}
            auto={false}
          />
        </>
      )}
    </Dialog>
  );
}
