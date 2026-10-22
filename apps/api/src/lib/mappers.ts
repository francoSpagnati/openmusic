import type { Release, ReleaseGroup, Track, User } from '@openmusic/db';
import {
  parseEdition,
  releaseYear,
  type AuthUser,
  type CatalogRelease,
  type CatalogTrack,
  type EditionSummary,
  type PublicUser,
  type ReleaseGroupRef,
  type UserSummary,
} from '@openmusic/shared';

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
    trackNumber: track.trackNumber,
    discNumber: track.discNumber,
    externalIds: {
      deezer: track.deezerId,
      itunes: track.itunesId,
      musicbrainz: track.musicbrainzId,
      spotify: track.spotifyId,
    },
  };
}

const DEFAULT_DOMINANT_COLOR = '#26262B';

/** ADR-012: stored label, else derived from the title qualifiers / disambiguation. */
export function editionLabelOf(
  release: Pick<Release, 'editionLabel' | 'title' | 'disambiguation'>
): string | null {
  return release.editionLabel ?? parseEdition(release.title, release.disambiguation).label;
}

export function toReleaseGroupRef(group: ReleaseGroup): ReleaseGroupRef {
  return { id: group.id, title: group.title, firstYear: group.firstReleaseYear };
}

/** Compact edition for lists (group page, "other editions"). */
export function toEditionSummary(release: Release): EditionSummary {
  return {
    id: release.id,
    title: release.title,
    editionLabel: editionLabelOf(release),
    releaseType: release.releaseType,
    releaseDate: release.releaseDate?.toISOString() ?? null,
    year: releaseYear(release.releaseDate),
    country: release.country,
    format: release.format,
    label: release.label,
    trackCount: release.trackCount,
    coverUrl: release.coverUrl,
    dominantColor: release.dominantColor ?? DEFAULT_DOMINANT_COLOR,
    audienceAvg: release.audienceAvg,
    audienceCount: release.audienceCount,
    criticAvg: release.criticAvg,
    criticCount: release.criticCount,
  };
}

/**
 * Release row (optionally with its tracks, already ordered) -> API shape. `group` is included
 * only when the row was loaded with its `releaseGroup` relation (`null` = not linked).
 */
export function toCatalogRelease(
  release: Release & { releaseGroup?: ReleaseGroup | null },
  tracks?: Track[]
): CatalogRelease {
  return {
    id: release.id,
    title: release.title,
    artistName: release.artistName,
    releaseType: release.releaseType,
    coverUrl: release.coverUrl,
    dominantColor: release.dominantColor ?? DEFAULT_DOMINANT_COLOR,
    releaseDate: release.releaseDate?.toISOString() ?? null,
    genres: release.genres,
    label: release.label,
    upc: release.upc,
    trackCount: release.trackCount,
    coverSource: release.coverSource,
    editionLabel: editionLabelOf(release),
    country: release.country,
    format: release.format,
    ...(release.releaseGroup !== undefined
      ? { group: release.releaseGroup ? toReleaseGroupRef(release.releaseGroup) : null }
      : {}),
    externalIds: {
      deezer: release.deezerId,
      itunes: release.itunesId,
      musicbrainz: release.musicbrainzId,
      musicbrainzReleaseGroup: release.musicbrainzReleaseGroupId,
      spotify: release.spotifyId,
    },
    audienceAvg: release.audienceAvg,
    audienceFreshPct: release.audienceFreshPct,
    audienceCount: release.audienceCount,
    criticAvg: release.criticAvg,
    criticFreshPct: release.criticFreshPct,
    criticCount: release.criticCount,
    tracks: tracks?.map((t) => toCatalogTrack({ ...t, release })),
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
