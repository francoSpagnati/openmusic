'use client';

import React from 'react';
import Link from 'next/link';
import type { ConversationSummary } from '@openmusic/shared';
import { Avatar, Skeleton, cn } from '@/components/ui';
import { absoluteTime, displayNameOf } from '@/components/web-core/format';
import { chatHref, inboxTime, messagePreview } from './chatFormat';

/** Inbox rows, newest first; the open conversation is marked with `aria-current`. */
export function ConversationList({
  conversations,
  activePeerId,
  viewerId,
}: {
  conversations: ConversationSummary[];
  activePeerId: string | null;
  viewerId: string;
}) {
  return (
    <ul aria-label="Conversazioni" className="divide-y divide-line">
      {conversations.map(({ otherUser, lastMessage, unreadCount }) => {
        const name = displayNameOf(otherUser);
        const active = otherUser.id === activePeerId;
        const unread = unreadCount > 0;
        return (
          <li key={otherUser.id}>
            <Link
              href={chatHref(otherUser.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-4 py-3 transition-colors duration-fast',
                'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
                active ? 'bg-surface' : 'hover:bg-surface/60'
              )}
            >
              <Avatar name={name} src={otherUser.avatarUrl} size="md" decorative />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span
                    className={cn(
                      'truncate text-sm text-ink',
                      unread ? 'font-bold' : 'font-semibold'
                    )}
                  >
                    {name}
                  </span>
                  <time
                    dateTime={lastMessage.createdAt}
                    title={absoluteTime(lastMessage.createdAt)}
                    className="shrink-0 font-mono text-[11px] tabular-nums text-ink-muted"
                  >
                    {inboxTime(lastMessage.createdAt)}
                  </time>
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'truncate text-xs',
                      unread ? 'font-medium text-ink' : 'text-ink-secondary'
                    )}
                  >
                    {messagePreview(lastMessage, lastMessage.senderId === viewerId)}
                  </span>
                  {unread && (
                    <span className="min-w-5 shrink-0 rounded-full bg-accent px-1.5 text-center font-mono text-[11px] font-bold leading-5 text-on-accent tabular-nums">
                      {unreadCount > 99 ? '99+' : unreadCount}
                      <span className="sr-only"> messaggi non letti</span>
                    </span>
                  )}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function ConversationListSkeleton() {
  return (
    <div aria-busy="true" className="divide-y divide-line">
      <span className="sr-only">Caricamento delle conversazioni…</span>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          <Skeleton shape="circle" className="h-10 w-10" />
          <Skeleton shape="text" lines={2} />
        </div>
      ))}
    </div>
  );
}
