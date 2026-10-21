import { prisma } from '@openmusic/db';
import {
  ChatMessageSchema,
  ConversationListSchema,
  NotificationPageSchema,
} from '@openmusic/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { AppContext } from '../src/app';
import { createRelease, createTracks, signedInUser } from './helpers/factories';
import { closeTestApp, createTestApp, resetTestState } from './helpers/test-app';

describe('chat', () => {
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

  async function send(headers: { authorization: string }, payload: Record<string, unknown>) {
    return ctx.app.inject({ method: 'POST', url: '/api/chat/messages', headers, payload });
  }

  it('sends text and track recommendations with universal links', async () => {
    const alice = await signedInUser(ctx);
    const bob = await signedInUser(ctx);
    const release = await createRelease();
    const [track] = await createTracks(release.id, 1);
    if (!track) throw new Error('track not created');

    const res = await send(alice.headers, {
      receiverId: bob.user.id,
      content: 'Ascolta questa',
      trackId: track.id,
    });
    expect(res.statusCode).toBe(201);
    const message = ChatMessageSchema.parse(res.json());
    expect(message.track?.id).toBe(track.id);
    expect(message.universalLinks?.openmusic).toContain(track.id);
    expect(message.readAt).toBeNull();
  });

  it('shares tracks imported from catalog search (non-UUID ids) and rejects unknown ones', async () => {
    const alice = await signedInUser(ctx);
    const bob = await signedInUser(ctx);
    const release = await prisma.release.create({
      data: { id: `deezer-alb-${Date.now()}`, title: 'Imported', artistName: 'Someone' },
    });
    const track = await prisma.track.create({
      data: {
        id: `deezer-trk-${Date.now()}`,
        title: 'Imported track',
        artistName: 'Someone',
        durationMs: 180_000,
        releaseId: release.id,
      },
    });

    const ok = await send(alice.headers, { receiverId: bob.user.id, trackId: track.id });
    expect(ok.statusCode).toBe(201);
    expect(ChatMessageSchema.parse(ok.json()).track?.id).toBe(track.id);

    const missing = await send(alice.headers, {
      receiverId: bob.user.id,
      trackId: 'deezer-trk-does-not-exist',
    });
    expect(missing.statusCode).toBe(400);
  });

  it('validates messages and recipients', async () => {
    const alice = await signedInUser(ctx);

    expect(
      (await send(alice.headers, { receiverId: alice.user.id, content: 'me' })).statusCode
    ).toBe(400);
    expect(
      (
        await send(alice.headers, {
          receiverId: '00000000-0000-4000-8000-000000000000',
          content: 'x',
        })
      ).statusCode
    ).toBe(404);
    const empty = await send(alice.headers, { receiverId: alice.user.id });
    expect(empty.statusCode).toBe(400);
    expect(empty.json().code).toBe('VALIDATION_ERROR');

    const anonymous = await ctx.app.inject({ method: 'GET', url: '/api/chat/conversations' });
    expect(anonymous.statusCode).toBe(401);
  });

  it('lists conversations with unread counts and marks them read', async () => {
    const alice = await signedInUser(ctx, { username: 'alice' });
    const bob = await signedInUser(ctx, { username: 'bob' });
    const carol = await signedInUser(ctx, { username: 'carol' });

    await send(bob.headers, { receiverId: alice.user.id, content: 'uno' });
    await send(bob.headers, { receiverId: alice.user.id, content: 'due' });
    await send(alice.headers, { receiverId: carol.user.id, content: 'ciao carol' });

    const inbox = await ctx.app.inject({
      method: 'GET',
      url: '/api/chat/conversations',
      headers: alice.headers,
    });
    const conversations = ConversationListSchema.parse(inbox.json());
    expect(
      conversations.map((c) => [c.otherUser.username, c.lastMessage.content, c.unreadCount])
    ).toEqual([
      ['carol', 'ciao carol', 0],
      ['bob', 'due', 2],
    ]);

    const read = await ctx.app.inject({
      method: 'POST',
      url: `/api/chat/conversation/${bob.user.id}/read`,
      headers: alice.headers,
    });
    expect(read.json()).toEqual({ updated: 2 });

    const thread = await ctx.app.inject({
      method: 'GET',
      url: `/api/chat/conversation/${bob.user.id}`,
      headers: alice.headers,
    });
    const messages = z.array(ChatMessageSchema).parse(thread.json());
    expect(messages.map((m) => m.content)).toEqual(['uno', 'due']);
    expect(messages.every((m) => m.readAt !== null)).toBe(true);
  });

  it('only the receiver can react or mark as listened; the sender is notified', async () => {
    const alice = await signedInUser(ctx);
    const bob = await signedInUser(ctx);
    const mallory = await signedInUser(ctx);
    const release = await createRelease();
    const [track] = await createTracks(release.id, 1);
    if (!track) throw new Error('track not created');

    const sent = ChatMessageSchema.parse(
      (await send(alice.headers, { receiverId: bob.user.id, trackId: track.id })).json()
    );

    for (const headers of [alice.headers, mallory.headers]) {
      const react = await ctx.app.inject({
        method: 'POST',
        url: '/api/chat/reaction',
        headers,
        payload: { messageId: sent.id, reaction: 'FIRE' },
      });
      expect(react.statusCode).toBe(403);
      const listened = await ctx.app.inject({
        method: 'POST',
        url: '/api/chat/listened',
        headers,
        payload: { messageId: sent.id },
      });
      expect(listened.statusCode).toBe(403);
    }

    const react = await ctx.app.inject({
      method: 'POST',
      url: '/api/chat/reaction',
      headers: bob.headers,
      payload: { messageId: sent.id, reaction: 'FIRE' },
    });
    expect(ChatMessageSchema.parse(react.json()).reaction).toBe('FIRE');

    for (let i = 0; i < 2; i++) {
      const listened = await ctx.app.inject({
        method: 'POST',
        url: '/api/chat/listened',
        headers: bob.headers,
        payload: { messageId: sent.id },
      });
      expect(ChatMessageSchema.parse(listened.json()).isListened).toBe(true);
    }

    const notifications = await ctx.app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: alice.headers,
    });
    const items = NotificationPageSchema.parse(notifications.json()).items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      type: 'TRACK_LISTENED',
      actor: { id: bob.user.id },
      track: { id: track.id },
    });
    expect(await prisma.notification.count()).toBe(1);
  });
});
