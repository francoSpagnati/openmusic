'use client';

import { useCallback, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useFriendsPresence } from '@/lib/socket';
import { useToast } from '@/components/ui';
import { errorMessage } from './format';

export interface GhostModeControl {
  /** Current (optimistic) value. */
  enabled: boolean;
  pending: boolean;
  set: (next: boolean) => Promise<void>;
}

/**
 * One-tap Ghost Mode. Over the socket the change is persisted AND pushed to followers at once;
 * without a live socket it falls back to `PATCH /api/auth/me`.
 */
export function useGhostMode(): GhostModeControl {
  const { user, refresh, updateProfile } = useAuth();
  const { setGhostMode } = useFriendsPresence();
  const { notify } = useToast();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);

  const set = useCallback(
    async (next: boolean) => {
      setOptimistic(next);
      setPending(true);
      try {
        const ack = await setGhostMode(next);
        if (ack.ok) await refresh();
        else await updateProfile({ isGhostMode: next });
        notify({
          tone: 'success',
          title: next ? 'Ghost Mode attiva' : 'Ghost Mode disattivata',
          description: next
            ? 'I tuoi amici non vedono cosa stai ascoltando.'
            : 'I tuoi amici vedono di nuovo i tuoi ascolti.',
        });
      } catch (err) {
        notify({
          tone: 'error',
          title: 'Non siamo riusciti a cambiare la Ghost Mode',
          description: errorMessage(err),
        });
      } finally {
        setOptimistic(null);
        setPending(false);
      }
    },
    [setGhostMode, refresh, updateProfile, notify]
  );

  return { enabled: optimistic ?? user?.isGhostMode ?? false, pending, set };
}
