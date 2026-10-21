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
        'relative flex gap-3 px-4 py-4 transition-colors duration-fast sm:gap-4 sm:px-5',
        'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus',
        unread ? 'bg-accent/[0.06] hover:bg-accent/10' : 'hover:bg-surface'
      )}
    >
      {unread && (
        <span
          aria-hidden="true"
          className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-accent"
        />
      )}
      <span className="relative h-fit shrink-0">
        {actor ? (
          <Avatar name={name} src={actor.avatarUrl} size="md" decorative />
        ) : (
          <span className="om-grooves block h-10 w-10 rounded-full" aria-hidden="true" />
        )}
        <span
          aria-hidden="true"
          className={cn(
            'absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-elevated ring-2 ring-canvas',
            meta.className
          )}
        >
          <TypeIcon weight="fill" className="h-3 w-3" />
        </span>
      </span>

      <span className="min-w-0 flex-1 space-y-1">
        <span className="block text-sm leading-relaxed text-ink-secondary">
          {unread && <span className="sr-only">Non letta: </span>}
          {actor && <strong className="font-semibold text-ink">{name} </strong>}
          {content.text}
        </span>
        {content.quote && (
          <span className="block border-l-2 border-line pl-3 font-editorial text-sm italic text-ink-secondary line-clamp-2">
            “{content.quote}”
          </span>
        )}
        <span className="flex items-center gap-2 font-mono text-xs text-ink-muted">
          <span>{meta.label}</span>
          <span aria-hidden="true">·</span>
          <TimeAgo iso={notification.createdAt} className="tabular-nums" />
        </span>
      </span>
    </Link>
  );
}
