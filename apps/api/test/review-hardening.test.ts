import { prisma } from '@openmusic/db';
import {
  AuthSessionResponseSchema,
  HttpUrlSchema,
  ReviewItemSchema,
  SESSION_COOKIE_NAME,
  UserProfileDataSchema,
} from '@openmusic/shared';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppContext } from '../src/app';
import { LastFmService } from '../src/modules/auth/lastfm.service';
import { createRelease, createTracks, signedInUser } from './helpers/factories';
import { closeTestApp, createTestApp, resetTestState } from './helpers/test-app';

/** Regression tests for the findings of the staff review of the web/API integration. */
describe('review hardening', () => {
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

  describe('user-supplied links are http(s) only (stored XSS)', () => {
    it.each(['javascript:alert(document.cookie)//', 'data:text/html,<script>1</script>'])(
      'rejects %s',
      (url) => {
        expect(HttpUrlSchema.safeParse(url).success).toBe(false);
      }
    );

    it('rejects a javascript: portfolio link on the accreditation request', async () => {
      const { headers } = await signedInUser(ctx);
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/critic/accredit',
        headers,
        payload: { outletName: 'Rumore', portfolioUrl: 'javascript:fetch("/x")//' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects javascript: links for avatars and critic reviews', async () => {
      const { headers } = await signedInUser(ctx);
      const avatar = await ctx.app.inject({
        method: 'PATCH',
        url: '/api/auth/me',
        headers,
        payload: { avatarUrl: 'javascript:alert(1)' },
      });
      expect(avatar.statusCode).toBe(400);

      const critic = await signedInUser(ctx, { role: 'CRITIC' });
      const release = await createRelease();
      const review = await ctx.app.inject({
        method: 'POST',
        url: '/api/critic/reviews',
        headers: critic.headers,
        payload: {
          releaseId: release.id,
          rating: 80,
          content: 'Un disco che resta.',
          originalReviewUrl: 'javascript:alert(1)',
        },
      });
      expect(review.statusCode).toBe(400);
    });
  });

  describe('reviews', () => {
    it('keeps one review per user per track (updates instead of duplicating)', async () => {
      const { user, headers } = await signedInUser(ctx);
      const release = await createRelease();
      const [track] = await createTracks(release.id, 1);
      for (const rating of [60, 90]) {
        const res = await ctx.app.inject({
          method: 'POST',
          url: '/api/reviews',
          headers,
          payload: { trackId: track?.id, rating },
        });
        expect(res.statusCode).toBe(201);
      }
      const rows = await prisma.review.findMany({ where: { userId: user.id, trackId: track?.id } });
      expect(rows.map((r) => r.rating)).toEqual([90]);
    });

    it('stores vibe tags without the leading #', async () => {
      const { headers } = await signedInUser(ctx);
      const release = await createRelease();
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/reviews',
        headers,
        payload: { releaseId: release.id, rating: 80, vibeTags: ['#Notturno', '##Pioggia'] },
      });
      expect(ReviewItemSchema.parse(res.json()).vibeTags).toEqual(['Notturno', 'Pioggia']);
    });

    it('updates the critic score when a critic reviews through /api/reviews', async () => {
      const critic = await signedInUser(ctx, { role: 'CRITIC' });
      const release = await createRelease();
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/reviews',
        headers: critic.headers,
        payload: { releaseId: release.id, rating: 80 },
      });
      expect(res.statusCode).toBe(201);
      const stored = await prisma.release.findUniqueOrThrow({ where: { id: release.id } });
      expect(stored).toMatchObject({ criticCount: 1, criticAvg: 4, audienceCount: 0 });
    });

    it('moves a review out of the audience score when its author becomes a critic', async () => {
      const writer = await signedInUser(ctx);
      const release = await createRelease();
      await ctx.app.inject({
        method: 'POST',
        url: '/api/reviews',
        headers: writer.headers,
        payload: { releaseId: release.id, rating: 40 },
      });
      expect(
        (await prisma.release.findUniqueOrThrow({ where: { id: release.id } })).audienceCount
      ).toBe(1);

      await prisma.user.update({ where: { id: writer.user.id }, data: { role: 'CRITIC' } });
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/critic/reviews',
        headers: writer.headers,
        payload: { releaseId: release.id, rating: 90, content: 'Ripensato: capolavoro.' },
      });
      expect(res.statusCode).toBe(201);
      const stored = await prisma.release.findUniqueOrThrow({ where: { id: release.id } });
      expect(stored).toMatchObject({
        audienceCount: 0,
        audienceAvg: null,
        criticCount: 1,
        criticAvg: 4.5,
      });
    });
  });

  describe('sessions', () => {
    it('revokes other sessions on password change and keeps the current one', async () => {
      const email = 'rev@example.com';
      const password = 'correct horse battery';
      const registered = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email, username: 'revoker', password },
      });
      const stolenToken = AuthSessionResponseSchema.parse(registered.json()).token;
      const login = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, password },
      });
      const current = AuthSessionResponseSchema.parse(login.json()).token;

      const change = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/password',
        headers: { authorization: `Bearer ${current}` },
        payload: { currentPassword: password, newPassword: 'another long passphrase' },
      });
      expect(change.statusCode).toBe(204);
      const fresh = change.cookies.find((c) => c.name === SESSION_COOKIE_NAME)?.value;
      expect(fresh).toBeTruthy();

      const me = (token: string) =>
        ctx.app.inject({
          method: 'GET',
          url: '/api/auth/me',
          headers: { authorization: `Bearer ${token}` },
        });
      expect((await me(stolenToken)).statusCode).toBe(401);
      expect((await me(current)).statusCode).toBe(401);
      expect((await me(fresh ?? '')).statusCode).toBe(200);
    });
  });

  describe('ghost mode', () => {
    it('PATCH /api/auth/me clears the live presence, not just the flag', async () => {
      const { user, headers } = await signedInUser(ctx);
      await ctx.nowPlayingService.updateUserNowPlaying(user.id, {
        trackId: 'trk-1',
        title: 'Svegliami',
        artistName: 'Artista',
        isPlaying: true,
        progressMs: 1000,
        durationMs: 180_000,
        provider: 'SPOTIFY',
        updatedAt: Date.now(),
      });
      const before = await ctx.redis.get(`presence:user:${user.id}`);
      expect(JSON.parse(before ?? '{}').currentlyPlaying).not.toBeNull();

      const res = await ctx.app.inject({
        method: 'PATCH',
        url: '/api/auth/me',
        headers,
        payload: { isGhostMode: true },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().user.isGhostMode).toBe(true);
      const after = JSON.parse((await ctx.redis.get(`presence:user:${user.id}`)) ?? '{}');
      expect(after).toMatchObject({ isGhostMode: true, currentlyPlaying: null });
    });
  });

  describe('Last.fm linking', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    async function startLink(headers: Record<string, string>) {
      const login = await ctx.app.inject({ method: 'GET', url: '/api/auth/lastfm/login', headers });
      const cookie = login.cookies.find((c) => c.name === 'om_oauth_state');
      const cb = new URL(new URL(login.json().url as string).searchParams.get('cb') ?? '');
      return { state: cb.searchParams.get('state'), cookie: `om_oauth_state=${cookie?.value}` };
    }

    it('rejects a callback without the state bound to this browser (login CSRF)', async () => {
      const getSession = vi.spyOn(LastFmService.prototype, 'getSession');
      const { headers } = await signedInUser(ctx);
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/auth/lastfm/callback?token=attacker-token',
        headers,
      });
      // The browser is sent back to the web app with the error, never to a JSON body.
      expect(res.statusCode).toBe(302);
      expect(res.headers.location).toMatch(/\/settings\?oauth=lastfm&status=error&code=FORBIDDEN$/);
      expect(getSession).not.toHaveBeenCalled();
    });

    it('links with a valid state but never moves a link owned by someone else', async () => {
      vi.spyOn(LastFmService.prototype, 'getSession').mockResolvedValue({
        name: 'shared_scrobbler',
        sessionKey: 'sk',
      });
      const owner = await signedInUser(ctx);
      const other = await signedInUser(ctx);

      const first = await startLink(owner.headers);
      expect(first.state).toBeTruthy();
      const linked = await ctx.app.inject({
        method: 'GET',
        url: `/api/auth/lastfm/callback?token=t1&state=${first.state}`,
        headers: { ...owner.headers, cookie: first.cookie },
      });
      expect(linked.statusCode).toBe(302);
      expect(linked.headers.location).toMatch(/\/settings\?oauth=lastfm&status=success$/);

      const second = await startLink(other.headers);
      const stolen = await ctx.app.inject({
        method: 'GET',
        url: `/api/auth/lastfm/callback?token=t2&state=${second.state}`,
        headers: { ...other.headers, cookie: second.cookie },
      });
      expect(stolen.statusCode).toBe(302);
      expect(stolen.headers.location).toMatch(/status=error&code=CONFLICT$/);
      const link = await prisma.connectedAccount.findFirstOrThrow({
        where: { provider: 'LASTFM', providerId: 'shared_scrobbler' },
      });
      expect(link.userId).toBe(owner.user.id);
    });
  });

  describe('profile heavy rotation', () => {
    it('ranks the last 30 days of scrobbles by play count', async () => {
      const { user } = await signedInUser(ctx);
      const release = await createRelease();
      const [a, b, c] = await createTracks(release.id, 3);
      const day = 24 * 60 * 60 * 1000;
      const plays = [
        { track: a, ago: 1 },
        { track: b, ago: 1 },
        { track: b, ago: 2 },
        { track: c, ago: 40 }, // outside the window
      ];
      await prisma.scrobbleLog.createMany({
        data: plays.map((p) => ({
          userId: user.id,
          trackId: p.track?.id ?? '',
          provider: 'SPOTIFY',
          playedAt: new Date(Date.now() - p.ago * day),
        })),
      });
      const res = await ctx.app.inject({ method: 'GET', url: `/api/profile/${user.id}` });
      expect(res.statusCode).toBe(200);
      const rotation = UserProfileDataSchema.parse(res.json()).heavyRotation;
      expect(rotation.map((r) => [r.track.id, r.playCount])).toEqual([
        [b?.id, 2],
        [a?.id, 1],
      ]);
    });
  });
});
