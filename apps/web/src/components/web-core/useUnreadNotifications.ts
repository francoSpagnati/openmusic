'use client';

import { useEffect, useState } from 'react';
import { WS_EVENTS } from '@openmusic/shared';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useSocketEvent } from '@/lib/socket';

/**
 * Unread notification count for the nav badge: fetched on sign-in and on window focus, bumped
 * live by `notification:new`.
 */
export function useUnreadNotifications(): number {
  const { status } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (status !== 'authenticated') {
      setCount(0);
      return;
    }
    let cancelled = false;
    const load = () => {
      api.notifications
        .unreadCount()
        .then((n) => {
          if (!cancelled) setCount(n);
        })
        .catch(() => {
          // A badge is not worth an error message; keep the last known value.
        });
    };
    load();
    window.addEventListener('focus', load);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', load);
    };
  }, [status]);

  useSocketEvent(WS_EVENTS.SERVER_NOTIFICATION, () => setCount((n) => n + 1));

  return count;
}
