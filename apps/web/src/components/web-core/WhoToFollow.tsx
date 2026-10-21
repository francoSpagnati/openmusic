'use client';

import React from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { ErrorState, Skeleton } from '@/components/ui';
import { FollowButton } from './FollowButton';
import { UserIdentity } from './UserIdentity';
import { useApiResource } from './useApiResource';
import { errorMessage } from './format';

/** "Chi seguire": most-followed people the viewer does not follow yet. */
export function WhoToFollow({
  limit = 4,
  onFollowChange,
  emptyText = 'Segui già tutti quelli che conosciamo. Prova la ricerca.',
}: {
  limit?: number;
  onFollowChange?: () => void;
  emptyText?: string;
}) {
  const { status, user } = useAuth();
  const key = status === 'loading' ? null : `suggestions:${user?.id ?? 'anon'}:${limit}`;
  const suggestions = useApiResource(key, () => api.users.suggestions({ limit }));

  if (suggestions.status === 'loading' || suggestions.status === 'idle') {
    return (
      <ul aria-busy="true" className="space-y-3">
        {Array.from({ length: Math.min(limit, 3) }, (_, i) => (
          <li key={i} className="flex items-center gap-3">
            <Skeleton shape="circle" className="h-10 w-10" />
            <Skeleton shape="text" lines={2} className="flex-1" />
          </li>
        ))}
      </ul>
    );
  }

  if (suggestions.status === 'error') {
    return (
      <ErrorState
        variant="inline"
        title="Suggerimenti non disponibili"
        description={errorMessage(suggestions.error)}
        onRetry={suggestions.reload}
      />
    );
  }

  const users = suggestions.data ?? [];
  if (users.length === 0) return <p className="text-sm text-ink-muted">{emptyText}</p>;

  return (
    <ul className="space-y-3">
      {users.map((u) => (
        <li key={u.id} className="flex items-center justify-between gap-2">
          <UserIdentity user={u} size="sm" />
          <FollowButton
            userId={u.id}
            username={u.username}
            isFollowing={u.isFollowedByMe}
            onChange={onFollowChange}
          />
        </li>
      ))}
    </ul>
  );
}
