'use client';

import React, { useId, useState } from 'react';
import { EyeSlash } from '@phosphor-icons/react';
import type { FriendPresence } from '@openmusic/shared';
import { useAuth } from '@/lib/auth';
import { useFriendsPresence } from '@/lib/socket';
import { Avatar, Skeleton, cn } from '@/components/ui';
import { displayNameOf } from '@/components/web-core/format';
import { isListening, sortFriends } from '@/components/web-social/presence/presence';
import { StoryListeningModal } from './StoryListeningModal';

interface LiveFriendsTickerProps {
  /** `band`: full-width strip for page tops. `compact`: inside a panel (chat inbox). */
  variant?: 'band' | 'compact';
  className?: string;
}

/**
 * Live strip of followed users listening right now (socket presence). Ghost Mode friends appear
 * only as "in Ghost Mode", never with their track. Renders nothing for anonymous visitors.
 */
export const LiveFriendsTicker: React.FC<LiveFriendsTickerProps> = ({
  variant = 'band',
  className,
}) => {
  const { status } = useAuth();
  const { friends, connected, error } = useFriendsPresence();
  const [open, setOpen] = useState<FriendPresence | null>(null);
  const titleId = useId();

  if (status !== 'authenticated') return null;

  const visible = sortFriends(friends.filter((f) => isListening(f) || f.isGhostMode));
  const listeningCount = visible.filter(isListening).length;
  // Keep the modal in sync with live updates of the friend it shows.
  const openFriend = open ? (friends.find((f) => f.userId === open.userId) ?? open) : null;

  return (
    <section
      aria-labelledby={titleId}
      className={cn(variant === 'band' ? 'border-y border-line py-3' : 'py-2', className)}
    >
      <div className={cn('flex items-center gap-3', variant === 'band' ? 'px-4 sm:px-6' : 'px-5')}>
        <h2 id={titleId} className="flex shrink-0 items-center gap-2 text-[13px] text-fg-muted">
          <span
            aria-hidden="true"
            className={cn(
              'h-1.5 w-1.5 rounded-full transition-colors duration-base',
              connected && listeningCount > 0 ? 'bg-fresh' : 'bg-fg-subtle'
            )}
          />
          In ascolto
          {connected && listeningCount > 0 && (
            <span className="font-mono tabular-nums text-fg-subtle">
              {listeningCount}
              <span className="sr-only"> amici</span>
            </span>
          )}
        </h2>

        {!connected ? (
          error ? (
            <p className="text-[13px] text-fg-subtle" role="status">
              Il live degli amici non è raggiungibile ora.
            </p>
          ) : (
            <div aria-busy="true" className="flex gap-2">
              <span className="sr-only">Collegamento al live…</span>
              <Skeleton shape="rect" className="h-8 w-28 rounded-full" />
            </div>
          )
        ) : visible.length === 0 ? (
          <p className="truncate text-[13px] text-fg-subtle">nessun amico, per ora</p>
        ) : (
          <ul className="[scrollbar-width:thin] -my-1 flex min-w-0 gap-2 overflow-x-auto py-1">
            {visible.map((friend) => (
              <li key={friend.userId} className="om-fade shrink-0">
                <FriendChip friend={friend} onOpen={() => setOpen(friend)} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <StoryListeningModal friend={openFriend} onClose={() => setOpen(null)} />
    </section>
  );
};

function FriendChip({ friend, onOpen }: { friend: FriendPresence; onOpen: () => void }) {
  const name = displayNameOf(friend);
  const track = friend.currentlyPlaying;
  const ghost = friend.isGhostMode;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex max-w-[15rem] items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-left transition-colors duration-fast ease-out',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        ghost
          ? 'border-dashed border-line-strong text-fg-subtle hover:text-fg-muted'
          : 'border-line bg-canvas hover:border-line-strong'
      )}
    >
      {ghost ? (
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sunken">
          <EyeSlash aria-hidden="true" className="h-3.5 w-3.5" />
        </span>
      ) : (
        <Avatar name={name} src={friend.avatarUrl} size="xs" status="live" decorative />
      )}
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-xs font-medium text-fg">{name}</span>
        <span
          key={track ? `${track.title}:${track.artistName}` : 'none'}
          className="om-fade block truncate text-xs text-fg-muted"
        >
          {ghost ? 'in Ghost Mode' : track ? `${track.title}, ${track.artistName}` : ''}
        </span>
      </span>
    </button>
  );
}
