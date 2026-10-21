import { describe, expect, it } from 'vitest';
import { aggregateScore } from '../src/modules/reviews/score';

describe('aggregateScore (ADR-001/ADR-002)', () => {
  it('returns nulls for no reviews', () => {
    expect(aggregateScore([])).toEqual({ avg: null, freshPct: null, count: 0 });
  });

  it('weighs verified listens 1.5x', () => {
    const score = aggregateScore([
      { rating: 100, isVerifiedListen: true },
      { rating: 40, isVerifiedListen: false },
    ]);
    // (150 + 40) / 2.5 = 76 -> 3.8; fresh 1.5 / 2.5 = 60%
    expect(score).toEqual({ avg: 3.8, freshPct: 60, count: 2 });
  });

  it('supports an unweighted aggregate', () => {
    const score = aggregateScore(
      [
        { rating: 100, isVerifiedListen: true },
        { rating: 40, isVerifiedListen: false },
      ],
      () => 1
    );
    expect(score).toEqual({ avg: 3.5, freshPct: 50, count: 2 });
  });
});
