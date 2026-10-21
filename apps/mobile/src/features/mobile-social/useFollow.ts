import { useCallback, useState } from 'react';
import type { FollowState } from '@openmusic/shared';
import { api } from '../../lib/api';
import { haptics } from './haptics';

/**
 * Optimistic follow toggle. `apply` receives the optimistic state first, then the server's
 * (or the previous state again on failure, with an error haptic).
 */
export function useFollow(
  apply: (
    state: Pick<FollowState, 'isFollowedByMe'> & {
      followersDelta?: number;
      followersCount?: number;
    }
  ) => void
) {
  const [busy, setBusy] = useState(false);

  const toggle = useCallback(
    async (userId: string, currentlyFollowing: boolean) => {
      if (busy) return;
      setBusy(true);
      haptics.tap();
      apply({ isFollowedByMe: !currentlyFollowing, followersDelta: currentlyFollowing ? -1 : 1 });
      try {
        const state = currentlyFollowing
          ? await api.users.unfollow(userId)
          : await api.users.follow(userId);
        if (state.isFollowedByMe) haptics.success();
        apply({ isFollowedByMe: state.isFollowedByMe, followersCount: state.followersCount });
      } catch {
        haptics.error();
        apply({ isFollowedByMe: currentlyFollowing, followersDelta: currentlyFollowing ? 1 : -1 });
      } finally {
        setBusy(false);
      }
    },
    [apply, busy]
  );

  return { toggle, busy };
}
