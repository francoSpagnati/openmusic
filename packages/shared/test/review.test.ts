import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { CreateReviewInputSchema, ToggleReactionInputSchema } from '../src/review';

describe('CreateReviewInputSchema', () => {
  const releaseId = randomUUID();

  it('accepts a minimal review and defaults vibeTags to []', () => {
    const parsed = CreateReviewInputSchema.parse({ releaseId, rating: 70 });
    expect(parsed).toEqual({ releaseId, rating: 70, vibeTags: [] });
  });

  it.each([10, 55, 100])('accepts rating %i (ADR-001 stores 10..100)', (rating) => {
    expect(CreateReviewInputSchema.safeParse({ releaseId, rating }).success).toBe(true);
  });

  it.each([0, 9, 101, 72.5])('rejects rating %s', (rating) => {
    expect(CreateReviewInputSchema.safeParse({ releaseId, rating }).success).toBe(false);
  });

  it('rejects more than 5 vibe tags and empty tags', () => {
    const tooMany = { releaseId, rating: 80, vibeTags: ['a', 'b', 'c', 'd', 'e', 'f'] };
    expect(CreateReviewInputSchema.safeParse(tooMany).success).toBe(false);
    expect(
      CreateReviewInputSchema.safeParse({ releaseId, rating: 80, vibeTags: [''] }).success
    ).toBe(false);
  });

  it('rejects content longer than 3000 characters', () => {
    const content = 'x'.repeat(3001);
    expect(CreateReviewInputSchema.safeParse({ releaseId, rating: 80, content }).success).toBe(
      false
    );
  });

  it('rejects non-UUID release ids', () => {
    expect(CreateReviewInputSchema.safeParse({ releaseId: 'rel_1', rating: 80 }).success).toBe(
      false
    );
  });
});

describe('ToggleReactionInputSchema', () => {
  it('rejects unknown reaction types', () => {
    const result = ToggleReactionInputSchema.safeParse({ reviewId: randomUUID(), type: 'LOL' });
    expect(result.success).toBe(false);
  });
});
