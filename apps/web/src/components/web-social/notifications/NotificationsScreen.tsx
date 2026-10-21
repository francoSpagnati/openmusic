'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Checks } from '@phosphor-icons/react';
import { WS_EVENTS, type NotificationItem } from '@openmusic/shared';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/auth';
import { useSocketEvent } from '@/lib/socket';
import {
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  Tabs,
  buttonClasses,
  useToast,
} from '@/components/ui';
import { RightSidebar } from '@/components/RightSidebar';
import { Sidebar } from '@/components/Sidebar';
import { LoadMore } from '@/components/web-core/LoadMore';
import { errorMessage } from '@/components/web-core/format';
import { usePagedList, type PagedList } from '@/components/web-core/usePagedList';
import { dayKey, dayLabel } from '../chat/chatFormat';
import { NotificationRow } from './NotificationRow';

type Filter = 'all' | 'unread';

/** Notifications with live arrivals, an unread filter, per-item and bulk "mark as read". */
export function NotificationsScreen() {
  const { ready, user } = useRequireAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const [markingAll, setMarkingAll] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const { notify } = useToast();

  const list = usePagedList<NotificationItem>(
    ready && user ? `notifications:${user.id}:${filter}` : null,
    (cursor) =>
      api.notifications.list({
        unreadOnly: filter === 'unread' ? 'true' : 'false',
        cursor,
        limit: 20,
      })
  );
  const { setItems } = list;
  const unreadLoaded = list.items.filter((n) => n.readAt === null).length;

  useSocketEvent(WS_EVENTS.SERVER_NOTIFICATION, (notification) => {
    setItems((prev) =>
      prev.some((n) => n.id === notification.id) ? prev : [notification, ...prev]
    );
    setAnnouncement('Nuova notifica');
  });

  function markLocally(ids: string[] | null) {
    const readAt = new Date().toISOString();
    setItems((prev) =>
      prev.map((n) => (n.readAt === null && (!ids || ids.includes(n.id)) ? { ...n, readAt } : n))
    );
  }

  function openOne(notification: NotificationItem) {
    if (notification.readAt !== null) return;
    markLocally([notification.id]);
    api.notifications.markRead([notification.id]).catch(() => {
      // Navigation continues; it will simply show as unread next time.
    });
  }

  async function markAll() {
    setMarkingAll(true);
    try {
      const updated = await api.notifications.markRead();
      markLocally(null);
      if (filter === 'unread') list.reload();
      notify({
        tone: 'success',
        title:
          updated === 1
            ? '1 notifica segnata come letta'
            : `${updated} notifiche segnate come lette`,
      });
    } catch (err) {
      notify({
        tone: 'error',
        title: 'Non siamo riusciti ad aggiornarle',
        description: errorMessage(err),
      });
    } finally {
      setMarkingAll(false);
    }
  }

  const body = <NotificationsBody list={list} filter={filter} onOpen={openOne} />;

  return (
    <div className="mx-auto flex max-w-7xl justify-center">
      <Sidebar />
      <div className="min-w-0 flex-1 border-line lg:border-r">
        <header className="flex flex-wrap items-end justify-between gap-3 px-4 pb-3 pt-6 sm:px-5">
          <div>
            <p className="om-eyebrow">Dal bancone</p>
            <h1 className="om-headline text-display-sm text-ink">Notifiche</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            leadingIcon={<Checks aria-hidden="true" />}
            loading={markingAll}
            loadingLabel="Aggiorno…"
            disabled={!ready || list.status !== 'success' || unreadLoaded === 0}
            onClick={() => void markAll()}
          >
            Segna tutte come lette
          </Button>
        </header>
        <p className="sr-only" role="status">
          {announcement}
        </p>

        <Tabs
          label="Filtra le notifiche"
          value={filter}
          onValueChange={(id) => setFilter(id === 'unread' ? 'unread' : 'all')}
          className="[&>[role=tablist]]:px-4 sm:[&>[role=tablist]]:px-5"
          panelClassName="pt-0"
          items={[
            { id: 'all', label: 'Tutte', content: body },
            {
              id: 'unread',
              label: 'Da leggere',
              count: filter === 'all' && list.status === 'success' ? unreadLoaded : undefined,
              content: body,
            },
          ]}
        />
      </div>
      <RightSidebar />
    </div>
  );
}

function NotificationsBody({
  list,
  filter,
  onOpen,
}: {
  list: PagedList<NotificationItem>;
  filter: Filter;
  onOpen: (n: NotificationItem) => void;
}) {
  if (list.status === 'idle' || (list.status === 'loading' && list.items.length === 0)) {
    return (
      <div aria-busy="true" className="divide-y divide-line">
        <span className="sr-only">Caricamento delle notifiche…</span>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-4 px-4 py-4 sm:px-5">
            <Skeleton shape="circle" className="h-10 w-10" />
            <Skeleton shape="text" lines={2} />
          </div>
        ))}
      </div>
    );
  }

  if (list.status === 'error') {
    return (
      <div className="p-4 sm:p-5">
        <ErrorState
          title="Le notifiche non si sono caricate"
          description={errorMessage(list.error)}
          onRetry={list.reload}
        />
      </div>
    );
  }

  if (list.items.length === 0) {
    return (
      <div className="p-4 sm:p-5">
        {filter === 'unread' ? (
          <EmptyState
            title="Sei in pari"
            description="Nessuna notifica da leggere. Il giradischi gira tranquillo."
          />
        ) : (
          <EmptyState
            title="Ancora silenzio"
            description="Qui arrivano follower, reazioni alle tue recensioni e i brani che i tuoi amici ascoltano su tuo consiglio."
            action={
              <Link href="/explore" className={buttonClasses({ variant: 'secondary' })}>
                Trova un disco da recensire
              </Link>
            }
          />
        )}
      </div>
    );
  }

  const groups: Array<{ key: string; label: string; items: NotificationItem[] }> = [];
  for (const n of list.items) {
    const key = dayKey(n.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(n);
    else groups.push({ key, label: dayLabel(n.createdAt), items: [n] });
  }

  return (
    <div aria-busy={list.status === 'loading'}>
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`notif-day-${group.key}`}>
          <h2
            id={`notif-day-${group.key}`}
            className="om-eyebrow border-b border-line bg-canvas px-4 py-2 sm:px-5"
          >
            {group.label}
          </h2>
          <ul className="divide-y divide-line border-b border-line">
            {group.items.map((n) => (
              <li key={n.id}>
                <NotificationRow notification={n} onOpen={onOpen} />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <LoadMore
        hasMore={list.hasMore}
        loading={list.loadingMore}
        error={list.moreError}
        onLoadMore={list.loadMore}
        label="Notifiche precedenti"
        endLabel="Fine del solco · niente di più vecchio"
      />
    </div>
  );
}
