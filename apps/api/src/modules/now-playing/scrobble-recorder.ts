import { createHash } from 'node:crypto';
import type { Redis } from 'ioredis';
import type { PrismaClient } from '@openmusic/db';
import { catalogMatchKey, normalizeIsrc, type SyncedProvider } from '@openmusic/shared';

/** Same window as the manual sync always used: one scrobble per user and track every 3 min. */
export const SCROBBLE_DEDUP_SECONDS = 180;
const DEFAULT_COLOR = '#D97736';

/** A track a provider says the user listened to, in provider-neutral form. */
export interface ListenedTrack {
  provider: SyncedProvider;
  title: string;
  artist: string;
  album: string | null;
  coverUrl: string | null;
  isrc: string | null;
  /** Spotify track id (or local-file URI); null for Last.fm. */
  spotifyId: string | null;
  /** 0 when unknown (Last.fm). */
  durationMs: number;
}

/** Internal catalog lookup/import (CatalogService.resolveListenedTrack). */
export interface ListenedTrackResolver {
  resolveListenedTrack(track: {
    title: string;
    artist: string;
    isrc: string | null;
  }): Promise<string | null>;
}

/**
 * Records verified listens (`ScrobbleLog`, ADR-002) for the manual sync and the background
 * poller: a Redis `SET NX EX 180` claim per user and track, then the track is matched to the
 * internal catalog (local ids → Deezer import when CATALOG_EXTERNAL_ENABLED) or, as a last
 * resort, created as a minimal local row so the listen is never lost.
 */
export class ScrobbleRecorder {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly resolver: ListenedTrackResolver | null
  ) {}

  /** Stable per-track id for deduplication (keeps the historical Spotify key format). */
  static dedupId(track: ListenedTrack): string {
    if (track.spotifyId) return track.spotifyId;
    const isrc = normalizeIsrc(track.isrc);
    if (isrc) return `isrc:${isrc}`;
    const key = catalogMatchKey(track.title, track.artist);
    return `lastfm:${createHash('sha1').update(key).digest('hex').slice(0, 16)}`;
  }

  /** True when this call won the 3-minute window and must record the scrobble. */
  async claim(userId: string, track: ListenedTrack): Promise<boolean> {
    const key = `scrobble:dedup:${userId}:${ScrobbleRecorder.dedupId(track)}`;
    const ok = await this.redis.set(key, '1', 'EX', SCROBBLE_DEDUP_SECONDS, 'NX');
    return ok === 'OK';
  }

  /** Gives a claim back when the scrobble could not be queued, so a later poll retries it. */
  async release(userId: string, track: ListenedTrack): Promise<void> {
    await this.redis.del(`scrobble:dedup:${userId}:${ScrobbleRecorder.dedupId(track)}`);
  }

  /** Writes the ScrobbleLog (call after a successful `claim`). Returns the internal track id. */
  async record(userId: string, track: ListenedTrack, playedAt: Date): Promise<string> {
    const dbTrack = await this.findOrCreateTrack(track);
    await this.prisma.scrobbleLog.create({
      data: {
        userId,
        trackId: dbTrack.id,
        releaseId: dbTrack.releaseId,
        provider: track.provider,
        playedAt,
      },
    });
    return dbTrack.id;
  }

  private async findLocal(track: ListenedTrack) {
    const isrc = normalizeIsrc(track.isrc);
    const ids = [
      ...(isrc ? [{ isrc }] : []),
      ...(track.spotifyId ? [{ spotifyId: track.spotifyId }] : []),
    ];
    if (ids.length > 0) {
      const byId = await this.prisma.track.findFirst({ where: { OR: ids } });
      if (byId) return byId;
    }
    return this.prisma.track.findFirst({
      where: {
        title: { equals: track.title, mode: 'insensitive' },
        artistName: { equals: track.artist, mode: 'insensitive' },
      },
      orderBy: { id: 'asc' },
    });
  }

  private async findOrCreateTrack(track: ListenedTrack) {
    const local = await this.findLocal(track);
    if (local) return local;

    const resolvedId = await this.resolver?.resolveListenedTrack(track);
    if (resolvedId) {
      const resolved = await this.prisma.track.findUnique({ where: { id: resolvedId } });
      if (resolved) {
        if (track.spotifyId && !resolved.spotifyId) {
          // Best effort: another row may already own this Spotify id (unique).
          await this.prisma.track
            .update({ where: { id: resolved.id }, data: { spotifyId: track.spotifyId } })
            .catch(() => undefined);
        }
        return resolved;
      }
    }

    // Offline / not found anywhere: a minimal local row, as the manual sync always did.
    const albumTitle = track.album || 'Single';
    const release =
      (await this.prisma.release.findFirst({
        where: { title: albumTitle, artistName: track.artist },
      })) ??
      (await this.prisma.release.create({
        data: {
          title: albumTitle,
          artistName: track.artist,
          coverUrl: track.coverUrl,
          dominantColor: DEFAULT_COLOR,
        },
      }));
    return this.prisma.track
      .create({
        data: {
          title: track.title,
          artistName: track.artist,
          isrc: normalizeIsrc(track.isrc),
          spotifyId: track.spotifyId,
          durationMs: track.durationMs,
          releaseId: release.id,
        },
      })
      .catch(async (err: unknown) => {
        // Unique ISRC/Spotify id created concurrently (another user, another instance): reuse it.
        const winner = await this.findLocal(track);
        if (winner) return winner;
        throw err;
      });
  }
}
