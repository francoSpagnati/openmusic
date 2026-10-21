import { useCallback, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { haptics } from './haptics';

export interface GhostModeState {
  isGhostMode: boolean;
  /** True while the change is being saved. */
  pending: boolean;
  /** Last failure, in Italian, or null. */
  error: string | null;
  setGhostMode: (next: boolean) => Promise<boolean>;
}

/**
 * One-tap Ghost Mode shared by the Home friends bar and Settings. Optimistic: flips at once and
 * saves with `PATCH /api/auth/me { isGhostMode }`, which persists the flag, broadcasts the new
 * presence to followers (same path as the socket toggle) and updates the auth user, so every
 * screen reads the same value. Rolls back with an error haptic on failure.
 */
export function useGhostMode(): GhostModeState {
  const { user, updateProfile } = useAuth();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setGhostMode = useCallback(
    async (next: boolean) => {
      haptics.tap();
      setOptimistic(next);
      setPending(true);
      setError(null);
      try {
        await updateProfile({ isGhostMode: next });
        return true;
      } catch {
        haptics.error();
        setError('Non siamo riusciti a cambiare la Ghost Mode. Riprova.');
        return false;
      } finally {
        setOptimistic(null);
        setPending(false);
      }
    },
    [updateProfile]
  );

  return { isGhostMode: optimistic ?? user?.isGhostMode ?? false, pending, error, setGhostMode };
}
