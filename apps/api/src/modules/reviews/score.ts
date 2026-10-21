import {
  FRESH_RATING_THRESHOLD,
  UNVERIFIED_LISTEN_WEIGHT,
  VERIFIED_LISTEN_WEIGHT,
} from '@openmusic/shared';

export interface ScoredReview {
  /** 10..100 */
  rating: number;
  isVerifiedListen: boolean;
}

export interface AggregateScore {
  /** Weighted mean on the 0.5..5.0 scale, one decimal. Null when there are no reviews. */
  avg: number | null;
  /** Weighted share of ratings >= 70, 0..100. Null when there are no reviews. */
  freshPct: number | null;
  /** Number of reviews (not the weight sum). */
  count: number;
}

export function audienceWeight(review: ScoredReview): number {
  return review.isVerifiedListen ? VERIFIED_LISTEN_WEIGHT : UNVERIFIED_LISTEN_WEIGHT;
}

/**
 * ADR-001 + ADR-002: weighted mean and weighted "fresh" share. Pass `() => 1` for an unweighted
 * aggregate (critic score).
 */
export function aggregateScore(
  reviews: readonly ScoredReview[],
  weightOf: (review: ScoredReview) => number = audienceWeight
): AggregateScore {
  if (reviews.length === 0) return { avg: null, freshPct: null, count: 0 };
  let weightSum = 0;
  let weightedRating = 0;
  let weightedFresh = 0;
  for (const r of reviews) {
    const w = weightOf(r);
    weightSum += w;
    weightedRating += w * r.rating;
    if (r.rating >= FRESH_RATING_THRESHOLD) weightedFresh += w;
  }
  return {
    avg: Math.round((weightedRating / weightSum / 20) * 10) / 10,
    freshPct: Math.round((weightedFresh / weightSum) * 100),
    count: reviews.length,
  };
}
