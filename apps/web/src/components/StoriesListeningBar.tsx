'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import type { FriendPresence } from '@openmusic/shared';
import { useAuth } from '@/lib/auth';
import { useFriendsPresence } from '@/lib/socket';
import { Avatar, Skeleton, cn } from '@/components/ui';
import { CoverArt } from '@/components/discovery/CoverArt';
import { displayNameOf } from '@/components/web-core/format';
import { useGhostMode } from '@/components/web-core/useGhostMode';
import {
  isListening,
  presenceStatus,
  sortFriends,
} from '@/components/web-social/presence/presence';
import { StoryListeningModal } from './StoryListeningModal';

/**
 * "Stories" row at the top of the feed: you (with one-tap Ghost Mode) and every followed user who
 * is online, listening ones first. Updates live over the socket. Hidden for anonymous visitors.
 */
export const StoriesListeningBar: React.FC = () => {
  const { status } = useAuth();
  const { friends, connected, error } = useFriendsPresence();
  const [openId, setOpenId] = useState<string | null>(null);

  if (status !== 'authenticated') return null;

  const sorted = sortFriends(friends);
  const openFriend = openId ? (friends.find((f) => f.userId === openId) ?? null) : null;

  return (
    <section aria-labelledby="stories-title" className="border-b border-line px-4 py-4 sm:px-5">
      <h2 id="stories-title" className="sr-only">
        Cosa ascoltano i tuoi amici adesso
      </h2>
      <ul className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-1 pt-1.5 [scrollbar-width:thin]">
        <li className="shrink-0">
          <MyBubble />
        </li>
        {!connected && !error
          ? [0, 1, 2, 3].map((i) => (
              <li
                key={i}
                aria-hidden="true"
                className="flex w-16 shrink-0 flex-col items-center gap-1.5"
              >
                <Skeleton shape="circle" className="h-14 w-14" />
                <Skeleton shape="text" lines={1} className="w-12" />
              </li>
            ))
          : sorted.map((friend) => (
              <li key={friend.userId} className="om-fade shrink-0">
                <FriendBubble friend={friend} onOpen={() => setOpenId(friend.userId)} />
              </li>
            ))}
        {connected && sorted.length === 0 && (
          <li className="flex min-w-[12rem] items-center text-sm text-fg-subtle">
            <p>
              Nessun amico online.{' '}
              <Link href="/explore" className="om-link">
                Trova chi seguire
              </Link>
            </p>
          </li>
        )}
        {error && !connected && (
          <li className="flex items-center text-sm text-fg-subtle" role="status">
            Il live degli amici non è raggiungibile ora.
          </li>
        )}
      </ul>
      <p className="sr-only" role="status" aria-live="polite">
        {connected ? `${sorted.filter(isListening).length} amici in ascolto` : ''}
      </p>

      <StoryListeningModal friend={openFriend} onClose={() => setOpenId(null)} />
    </section>
  );
};

function BubbleLabel({ name, sub, tone }: { name: string; sub: string; tone: 'live' | 'muted' }) {
  return (
    <span className="flex w-16 flex-col items-center">
      <span className="w-full truncate text-center text-xs font-medium text-fg">{name}</span>
      <span
        key={sub}
        className={cn(
          'om-fade w-full truncate text-center text-[11px] leading-tight',
          tone === 'live' ? 'text-fresh' : 'text-fg-subtle'
        )}
      >
        {sub}
      </span>
    </span>
  );
}

function MyBubble() {
  const { user } = useAuth();
  const ghost = useGhostMode();
  if (!user) return null;
  const name = displayNameOf(user);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="relative">
        <Avatar
          name={name}
          src={user.avatarUrl}
          size="lg"
          status={ghost.enabled ? 'ghost' : 'online'}
          decorative
        />
        <button
          type="button"
          aria-pressed={ghost.enabled}
          aria-busy={ghost.pending || undefined}
          disabled={ghost.pending}
          onClick={() => void ghost.set(!ghost.enabled)}
          title={ghost.enabled ? 'Disattiva Ghost Mode' : 'Attiva Ghost Mode'}
          className={cn(
            'absolute -bottom-1 -left-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-canvas transition-colors duration-fast ease-out',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus',
            'disabled:cursor-progress',
            ghost.enabled ? 'bg-fg text-canvas' : 'bg-surface-raised text-fg shadow-hairline'
          )}
        >
          {ghost.enabled ? (
            <EyeSlash aria-hidden="true" weight="bold" className="h-3.5 w-3.5" />
          ) : (
            <Eye aria-hidden="true" weight="bold" className="h-3.5 w-3.5" />
          )}
          <span className="sr-only">Ghost Mode</span>
        </button>
      </span>
      <BubbleLabel
        name="Tu"
        sub={ghost.enabled ? 'Incognito' : 'Visibile'}
        tone={ghost.enabled ? 'muted' : 'live'}
      />
    </div>
  );
}

function FriendBubble({ friend, onOpen }: { friend: FriendPresence; onOpen: () => void }) {
  const name = displayNameOf(friend);
  const listening = isListening(friend);
  const track = listening ? friend.currentlyPlaying : null;
  const firstName = name.split(/\s+/)[0] ?? name;
  const sub = friend.isGhostMode ? 'Ghost' : track ? track.artistName : 'online';
  const label = track
    ? `${name}: sta ascoltando ${track.title} di ${track.artistName}`
    : friend.isGhostMode
      ? `${name}, in Ghost Mode`
      : `${name}, online`;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      className="om-press group flex flex-col items-center gap-1.5 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
    >
      <span
        className={cn(
          'relative rounded-full',
          friend.isGhostMode && 'outline-dashed outline-1 outline-offset-2 outline-line-strong'
        )}
      >
        <Avatar
          name={name}
          src={friend.avatarUrl}
          size="lg"
          status={presenceStatus(friend)}
          decorative
        />
        {track && (
          <CoverArt
            key={track.coverUrl ?? track.title}
            src={track.coverUrl}
            alt=""
            sizes="24px"
            className="om-fade absolute -bottom-1 -left-1 h-6 w-6 rounded-sm ring-2 ring-canvas"
          />
        )}
      </span>
      <BubbleLabel name={firstName} sub={sub} tone={track ? 'live' : 'muted'} />
    </button>
  );
}
