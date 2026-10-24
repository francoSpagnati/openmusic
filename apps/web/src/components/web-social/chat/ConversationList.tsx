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
    <ul aria-label="Conversazioni" className="space-y-0.5 px-2 py-2">
      {conversations.map(({ otherUser, lastMessage, unreadCount }) => {
        const name = displayNameOf(otherUser);
        const active = otherUser.id === activePeerId;
        const unread = unreadCount > 0;
        return (
          <li key={otherUser.id} className="om-fade">
            <Link
              href={chatHref(otherUser.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-3 transition-colors duration-fast ease-out',
                'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
                active ? 'bg-surface' : 'hover:bg-fg/[0.04]'
              )}
            >
              <Avatar name={name} src={otherUser.avatarUrl} size="md" decorative />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span
                    className={cn(
                      'truncate text-sm text-fg',
                      unread ? 'font-semibold' : 'font-medium'
                    )}
                  >
                    {name}
                  </span>
                  <time
                    dateTime={lastMessage.createdAt}
                    title={absoluteTime(lastMessage.createdAt)}
                    className="shrink-0 text-xs tabular-nums text-fg-subtle"
                  >
                    {inboxTime(lastMessage.createdAt)}
                  </time>
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-3">
                  <span className={cn('truncate text-sm', unread ? 'text-fg' : 'text-fg-muted')}>
                    {messagePreview(lastMessage, lastMessage.senderId === viewerId)}
                  </span>
                  {unread && (
                    <span className="flex h-5 shrink-0 items-center">
                      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
                      <span className="sr-only">
                        {unreadCount === 1
                          ? '1 messaggio non letto'
                          : `${unreadCount > 99 ? 'Più di 99' : unreadCount} messaggi non letti`}
                      </span>
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
    <div aria-busy="true" className="space-y-0.5 px-2 py-2">
      <span className="sr-only">Caricamento delle conversazioni…</span>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3">
          <Skeleton shape="circle" className="h-10 w-10" />
          <Skeleton shape="text" lines={2} />
        </div>
      ))}
    </div>
  );
}
