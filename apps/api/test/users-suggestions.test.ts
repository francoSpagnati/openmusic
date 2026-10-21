import { UserSuggestionListSchema } from '@openmusic/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AppContext } from '../src/app';
import { signedInUser } from './helpers/factories';
import { closeTestApp, createTestApp, resetTestState } from './helpers/test-app';

describe('GET /api/users/suggestions', () => {
  let ctx: AppContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  beforeEach(async () => {
    await resetTestState(ctx);
  });

  afterAll(async () => {
    await closeTestApp(ctx);
  });

  it('excludes the viewer and people they already follow, most-followed first', async () => {
    const alice = await signedInUser(ctx, { username: 'alice' });
    const bob = await signedInUser(ctx, { username: 'bob' });
    const carol = await signedInUser(ctx, { username: 'carol' });
    const dave = await signedInUser(ctx, { username: 'dave' });

    // carol has 2 followers, dave 1; alice already follows bob.
    for (const [who, target] of [
      [alice, bob],
      [bob, carol],
      [dave, carol],
      [bob, dave],
    ] as const) {
      const res = await ctx.app.inject({
        method: 'PUT',
        url: `/api/users/${target.user.id}/follow`,
        headers: who.headers,
      });
      expect(res.statusCode).toBe(200);
    }

    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/users/suggestions?limit=10',
      headers: alice.headers,
    });
    expect(res.statusCode).toBe(200);
    const list = UserSuggestionListSchema.parse(res.json());
    expect(list.map((u) => u.username)).toEqual(['carol', 'dave']);
    expect(list.every((u) => !u.isFollowedByMe)).toBe(true);
  });

  it('works anonymously and validates the limit', async () => {
    await signedInUser(ctx, { username: 'erin' });
    const ok = await ctx.app.inject({ method: 'GET', url: '/api/users/suggestions' });
    expect(ok.statusCode).toBe(200);
    expect(UserSuggestionListSchema.parse(ok.json()).map((u) => u.username)).toContain('erin');

    const bad = await ctx.app.inject({ method: 'GET', url: '/api/users/suggestions?limit=99' });
    expect(bad.statusCode).toBe(400);
  });
});
