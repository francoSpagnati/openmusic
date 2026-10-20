import { randomUUID } from 'node:crypto';
import { prisma, type Release, type Role, type User } from '@openmusic/db';

export function createUser(overrides: { username?: string; role?: Role } = {}): Promise<User> {
  const username = overrides.username ?? `user_${randomUUID().slice(0, 8)}`;
  return prisma.user.create({
    data: { username, email: `${username}@openmusic.test`, role: overrides.role ?? 'USER' },
  });
}

export function createRelease(title = 'Test Release'): Promise<Release> {
  return prisma.release.create({
    data: { title, artistName: 'Test Artist', genres: ['Test'] },
  });
}
