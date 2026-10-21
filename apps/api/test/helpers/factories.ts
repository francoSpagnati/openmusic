import { randomUUID } from 'node:crypto';
import { prisma, type Release, type Role, type Track, type User } from '@openmusic/db';
import type { AppContext } from '../../src/app';

export function createUser(overrides: { username?: string; role?: Role } = {}): Promise<User> {
  const username = overrides.username ?? `user_${randomUUID().slice(0, 8)}`;
  return prisma.user.create({
    data: { username, email: `${username}@openmusic.test`, role: overrides.role ?? 'USER' },
  });
}

export function createRelease(title = 'Test Release', genres = ['Test']): Promise<Release> {
  return prisma.release.create({
    data: { title, artistName: 'Test Artist', genres },
  });
}

export async function createTracks(releaseId: string, count: number): Promise<Track[]> {
  const tracks: Track[] = [];
  for (let i = 0; i < count; i++) {
    tracks.push(
      await prisma.track.create({
        data: {
          title: `Track ${i + 1}`,
          artistName: 'Test Artist',
          durationMs: 180_000,
          releaseId,
        },
      })
    );
  }
  return tracks;
}

/** Signs a session token for `userId` without going through password hashing. */
export function tokenFor(ctx: AppContext, userId: string): string {
  return ctx.app.jwt.sign({ sub: userId });
}

export function bearer(ctx: AppContext, userId: string): { authorization: string } {
  return { authorization: `Bearer ${tokenFor(ctx, userId)}` };
}

/** A user plus ready-to-use auth headers. */
export async function signedInUser(
  ctx: AppContext,
  overrides: { username?: string; role?: Role } = {}
): Promise<{ user: User; headers: { authorization: string } }> {
  const user = await createUser(overrides);
  return { user, headers: bearer(ctx, user.id) };
}
