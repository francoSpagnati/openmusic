import { useCallback } from 'react';
import type { Post } from '@openmusic/shared';
import { api } from '../../lib/api';
import { haptics } from './haptics';

type SetPosts = (updater: (prev: Post[]) => Post[]) => void;

/**
 * Optimistic like / save / delete for a list of posts. Each action flips the row at once, then
 * applies the server state (or rolls back with an error haptic).
 */
export function usePostActions(setItems: SetPosts) {
  const patch = useCallback(
    (id: string, fields: Partial<Post>) =>
      setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...fields } : p))),
    [setItems]
  );

  const toggleLike = useCallback(
    async (post: Post) => {
      haptics.tap();
      patch(post.id, {
        isLikedByMe: !post.isLikedByMe,
        likeCount: Math.max(0, post.likeCount + (post.isLikedByMe ? -1 : 1)),
      });
      try {
        const state = post.isLikedByMe
          ? await api.feed.unlike(post.id)
          : await api.feed.like(post.id);
        patch(post.id, { isLikedByMe: state.isLikedByMe, likeCount: state.likeCount });
      } catch {
        haptics.error();
        patch(post.id, { isLikedByMe: post.isLikedByMe, likeCount: post.likeCount });
      }
    },
    [patch]
  );

  const toggleSave = useCallback(
    async (post: Post) => {
      haptics.tap();
      patch(post.id, { isSavedByMe: !post.isSavedByMe });
      try {
        const state = post.isSavedByMe
          ? await api.feed.unsave(post.id)
          : await api.feed.save(post.id);
        patch(post.id, { isSavedByMe: state.isSavedByMe });
      } catch {
        haptics.error();
        patch(post.id, { isSavedByMe: post.isSavedByMe });
      }
    },
    [patch]
  );

  /** Resolves false (and restores the post) when the API refuses. */
  const remove = useCallback(
    async (post: Post): Promise<boolean> => {
      let index = -1;
      setItems((prev) => {
        index = prev.findIndex((p) => p.id === post.id);
        return prev.filter((p) => p.id !== post.id);
      });
      try {
        await api.feed.remove(post.id);
        haptics.success();
        return true;
      } catch {
        haptics.error();
        setItems((prev) => {
          if (prev.some((p) => p.id === post.id)) return prev;
          const next = [...prev];
          next.splice(index < 0 ? 0 : Math.min(index, next.length), 0, post);
          return next;
        });
        return false;
      }
    },
    [setItems]
  );

  return { toggleLike, toggleSave, remove };
}
