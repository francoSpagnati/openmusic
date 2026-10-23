'use client';

import React from 'react';
import Link from 'next/link';
import { useFriendsPresence } from '@/lib/socket';
import { Avatar } from '@/components/ui';
import { displayNameOf, profileHref } from '../format';

/** Followed users playing something right now (Ghost Mode users are never listed). */
export function FriendsListening({ max = 5 }: { max?: number }) {
  const { friends, connected, error } = useFriendsPresence();
  const listening = friends.filter((f) => !f.isGhostMode && f.currentlyPlaying?.isPlaying);

  if (!connected) {
    return (
      <p className="text-sm text-fg-subtle" role="status">
        {error ? 'Il live degli amici non è raggiungibile ora.' : 'Collegamento al live…'}
      </p>
    );
  }

  if (listening.length === 0) {
    return (
      <p className="text-sm text-fg-subtle">
        Nessuno dei tuoi amici sta ascoltando in questo momento.
      </p>
    );
  }

  return (
    <ul className="space-y-3" aria-live="polite">
      {listening.slice(0, max).map((friend) => {
        const track = friend.currentlyPlaying;
        const name = displayNameOf(friend);
        return (
          <li key={friend.userId}>
            <Link
              href={profileHref(friend)}
              className="group flex items-center gap-3 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <Avatar name={name} src={friend.avatarUrl} size="sm" status="live" decorative />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-fg group-hover:underline">
                  {name}
                </span>
                {track && (
                  <span className="block truncate text-xs text-fg-muted">
                    {track.title} <span className="text-fg-subtle">di {track.artistName}</span>
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
