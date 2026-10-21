import type { Release, Track, User } from '@openmusic/db';
import type { AuthUser, CatalogTrack, PublicUser, UserSummary } from '@openmusic/shared';

export function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    role: user.role,
    isGhostMode: user.isGhostMode,
    favoriteGenres: user.favoriteGenres,
    hasPassword: user.passwordHash !== null,
    createdAt: user.createdAt.toISOString(),
  };
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    role: user.role,
    criticOutlet: user.role === 'CRITIC' ? user.criticOutlet : null,
    createdAt: user.createdAt.toISOString(),
  };
}

/** Columns needed by `toUserSummary`; use as a Prisma `select`. */
export const USER_SUMMARY_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  role: true,
} as const;

export type UserSummaryRow = Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl' | 'role'>;

export function toUserSummary(user: UserSummaryRow, followedIds: ReadonlySet<string>): UserSummary {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
    isFollowedByMe: followedIds.has(user.id),
  };
}

export function toCatalogTrack(
  track: Track & { release: Pick<Release, 'coverUrl'> }
): CatalogTrack {
  return {
    id: track.id,
    isrc: track.isrc,
    title: track.title,
    artistName: track.artistName,
    durationMs: track.durationMs,
    previewUrl: track.previewUrl,
    releaseId: track.releaseId,
    coverUrl: track.release.coverUrl,
  };
}

/** Opaque cursor helpers: cursors are the id of the last item of the previous page. */
export function nextCursorOf<T extends { id: string }>(
  rows: T[],
  limit: number
): {
  items: T[];
  nextCursor: string | null;
} {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return { items, nextCursor: hasMore && last ? last.id : null };
}
