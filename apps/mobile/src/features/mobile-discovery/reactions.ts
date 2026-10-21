import type { ReactionType, ReviewItem } from '@openmusic/shared';

export const REACTION_TYPES: readonly ReactionType[] = [
  'AGREE',
  'WELL_WRITTEN',
  'DISCOVERED',
  'HEART',
];

export const REACTION_LABELS: Record<ReactionType, string> = {
  AGREE: 'Condivido',
  WELL_WRITTEN: 'Bella penna',
  DISCOVERED: 'Scoperto grazie a te',
  HEART: 'Mi piace',
};

/** Reactions the viewer left on a review (`userReactions`, else the legacy `userReaction`). */
export function myReactions(review: ReviewItem): ReactionType[] {
  if (review.userReactions) return review.userReactions;
  return review.userReaction ? [review.userReaction] : [];
}

/** Optimistic toggle of one reaction: count ±1 and the viewer's set updated. */
export function applyReaction(review: ReviewItem, type: ReactionType, added: boolean): ReviewItem {
  const mine = new Set(myReactions(review));
  if (added) mine.add(type);
  else mine.delete(type);
  const count = review.reactions[type] ?? 0;
  return {
    ...review,
    reactions: { ...review.reactions, [type]: Math.max(0, count + (added ? 1 : -1)) },
    userReactions: REACTION_TYPES.filter((t) => mine.has(t)),
    userReaction: mine.has(type) ? type : (REACTION_TYPES.find((t) => mine.has(t)) ?? null),
  };
}
