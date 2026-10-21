import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { WS_EVENTS } from '@openmusic/shared';
import { api } from '../../lib/api';
import { useSocketEvent } from '../../lib/socket';

/**
 * Unread notifications badge: `GET /api/notifications/unread-count` whenever the screen gains
 * focus (e.g. back from the notifications list) and +1 for each live `notification:new`.
 */
export function useUnreadNotifications(): number {
  const [count, setCount] = useState(0);

  const load = useCallback(() => {
    let cancelled = false;
    api.notifications
      .unreadCount()
      .then((n) => {
        if (!cancelled) setCount(n);
      })
      .catch(() => {
        // The badge is a hint: keep the last known value on failure.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useFocusEffect(load);
  useSocketEvent(WS_EVENTS.SERVER_NOTIFICATION, () => setCount((c) => c + 1));

  return count;
}
