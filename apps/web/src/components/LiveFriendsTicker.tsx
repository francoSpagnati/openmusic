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
      className={cn(
        variant === 'band' ? 'border-y border-line bg-surface/60 py-3' : 'py-2',
        className
      )}
    >
      <div className={cn('flex items-center gap-3', variant === 'band' ? 'px-4 sm:px-6' : 'px-4')}>
        <h2
          id={titleId}
          className="flex shrink-0 items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-secondary"
        >
          <span
            aria-hidden="true"
            className={cn('h-2 w-2 rounded-full', connected ? 'bg-live' : 'bg-ink-muted')}
          />
          In ascolto
          {connected && (
            <span className="tabular-nums text-ink-muted">
              {listeningCount}
              <span className="sr-only"> amici</span>
            </span>
          )}
        </h2>

        {!connected ? (
          error ? (
            <p className="text-xs text-ink-muted" role="status">
              Il live degli amici non è raggiungibile ora.
            </p>
          ) : (
            <div aria-busy="true" className="flex gap-2">
              <span className="sr-only">Collegamento al live…</span>
              <Skeleton shape="rect" className="h-8 w-28 rounded-full" />
              <Skeleton shape="rect" className="h-8 w-24 rounded-full" />
            </div>
          )
        ) : visible.length === 0 ? (
          <p className="truncate text-xs text-ink-muted">Nessun amico sta ascoltando ora.</p>
        ) : (
          <ul className="[scrollbar-width:thin] -my-1 flex min-w-0 gap-2 overflow-x-auto py-1">
            {visible.map((friend) => (
              <li key={friend.userId} className="shrink-0">
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
        'flex max-w-[15rem] items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-left transition-colors duration-fast',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
        ghost
          ? 'border-dashed border-line-strong text-ink-muted hover:text-ink-secondary'
          : 'border-line bg-canvas hover:border-accent'
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
        <span className="block truncate text-xs font-semibold text-ink">{name}</span>
        <span className="block truncate text-[11px] text-ink-secondary">
          {ghost ? 'in Ghost Mode' : track ? `${track.title} · ${track.artistName}` : ''}
        </span>
      </span>
    </button>
  );
}
