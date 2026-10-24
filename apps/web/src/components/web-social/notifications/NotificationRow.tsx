'use client';

import React from 'react';
import Link from 'next/link';
import type { NotificationItem } from '@openmusic/shared';
import { Avatar, cn } from '@/components/ui';
import { TimeAgo } from '@/components/web-core/TimeAgo';
import { displayNameOf } from '@/components/web-core/format';
import { NOTIFICATION_ICON, notificationContent } from './notificationContent';

/** One notification: the whole row links to its context and marks it as read. */
export function NotificationRow({
  notification,
  onOpen,
}: {
  notification: NotificationItem;
  onOpen: (notification: NotificationItem) => void;
}) {
  const { actor } = notification;
  const unread = notification.readAt === null;
  const content = notificationContent(notification);
  const meta = NOTIFICATION_ICON[notification.type];
  const TypeIcon = meta.icon;
  const name = actor ? displayNameOf(actor) : 'OpenMusic';

  return (
    <Link
      href={content.href}
      onClick={() => onOpen(notification)}
      className={cn(
        'flex gap-4 rounded-lg px-3 py-3.5 transition-colors duration-fast ease-out',
        'hover:bg-fg/[0.04]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus'
      )}
    >
      <span className="relative h-fit shrink-0">
        {actor ? (
          <Avatar name={name} src={actor.avatarUrl} size="md" decorative />
        ) : (
          <span className="om-grooves block h-10 w-10 rounded-full" aria-hidden="true" />
        )}
        <span
          aria-hidden="true"
          className={cn(
            'absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface-raised ring-2 ring-canvas',
            meta.className
          )}
        >
          <TypeIcon className="h-3 w-3" />
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm leading-relaxed', unread ? 'text-fg' : 'text-fg-muted')}>
          {unread && <span className="sr-only">Non letta: </span>}
          {actor && <strong className="font-semibold text-fg">{name} </strong>}
          {content.text}
        </span>
        {content.quote && (
          <span className="mt-1.5 block border-l-2 border-line pl-3 font-editorial text-sm italic text-fg-muted line-clamp-2">
            “{content.quote}”
          </span>
        )}
        <span className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-fg-subtle">
          <span>{meta.label}</span>
          <TimeAgo iso={notification.createdAt} />
        </span>
      </span>

      {unread && (
        <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />
      )}
    </Link>
  );
}
