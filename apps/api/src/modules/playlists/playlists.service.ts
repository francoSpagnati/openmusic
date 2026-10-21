import type { PrismaClient } from '@openmusic/db';
import type { PlaylistDetails, PlaylistSummary, PlaylistTrackItem } from '@openmusic/shared';
import type { AddTrackToPlaylistInputSchema, CreatePlaylistInputSchema } from '@openmusic/shared';
import type { z } from 'zod';
import { ForbiddenError, NotFoundError } from '../../lib/errors';
import { toCatalogTrack } from '../../lib/mappers';

type CreatePlaylistInput = z.output<typeof CreatePlaylistInputSchema>;
type AddTrackToPlaylistInput = z.output<typeof AddTrackToPlaylistInputSchema>;

export class PlaylistsService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Crea una nuova playlist tematica
   */
  async createPlaylist(userId: string, input: CreatePlaylistInput): Promise<PlaylistDetails> {
    const playlist = await this.prisma.playlist.create({
      data: {
        userId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        isPublic: input.isPublic,
      },
      include: {
        user: { select: { id: true, username: true, displayName: true } },
      },
    });

    return {
      id: playlist.id,
      userId: playlist.userId,
      user: playlist.user,
      title: playlist.title,
      description: playlist.description,
      coverUrl: playlist.coverUrl,
      isPublic: playlist.isPublic,
      sideATracks: [],
      sideBTracks: [],
      totalDurationMs: 0,
      createdAt: playlist.createdAt.toISOString(),
    };
  }

  /**
   * Aggiunge un brano specificando il lato (Lato A o Lato B)
   */
  async addTrackToPlaylist(
    userId: string,
    input: AddTrackToPlaylistInput
  ): Promise<PlaylistDetails> {
    const { playlistId, trackId, side } = input;

    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
    });

    if (!playlist) throw new NotFoundError('Playlist non trovata');
    if (playlist.userId !== userId) {
      throw new ForbiddenError('Puoi modificare solo le tue playlist');
    }

    // Calcola la posizione successiva per il lato selezionato
    const currentMax = await this.prisma.playlistTrack.aggregate({
      where: { playlistId, side },
      _max: { position: true },
    });
    const nextPosition = (currentMax._max.position ?? -1) + 1;

    await this.prisma.playlistTrack.upsert({
      where: {
        playlistId_trackId: {
          playlistId,
          trackId,
        },
      },
      update: { side, position: nextPosition },
      create: {
        playlistId,
        trackId,
        side,
        position: nextPosition,
      },
    });

    return this.getPlaylistDetails(playlistId, userId);
  }

  /**
   * Restituisce i dettagli completi con tracce divise per Lato A e Lato B
   */
  async getPlaylistDetails(playlistId: string, viewerId: string | null): Promise<PlaylistDetails> {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id: playlistId },
      include: {
        user: { select: { id: true, username: true, displayName: true } },
        tracks: {
          include: {
            track: {
              include: { release: true },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    // Private playlists are invisible (404, not 403) to everyone but their owner.
    if (!playlist || (!playlist.isPublic && playlist.userId !== viewerId)) {
      throw new NotFoundError('Playlist non trovata');
    }

    const sideATracks: PlaylistTrackItem[] = [];
    const sideBTracks: PlaylistTrackItem[] = [];
    let totalDurationMs = 0;

    for (const item of playlist.tracks) {
      totalDurationMs += item.track.durationMs;
      const trackPayload: PlaylistTrackItem = {
        id: item.id,
        side: item.side as 'A' | 'B',
        position: item.position,
        addedAt: item.addedAt.toISOString(),
        track: toCatalogTrack(item.track),
      };

      if (item.side === 'A') {
        sideATracks.push(trackPayload);
      } else {
        sideBTracks.push(trackPayload);
      }
    }

    return {
      id: playlist.id,
      userId: playlist.userId,
      user: playlist.user,
      title: playlist.title,
      description: playlist.description,
      coverUrl: playlist.coverUrl,
      isPublic: playlist.isPublic,
      sideATracks,
      sideBTracks,
      totalDurationMs,
      createdAt: playlist.createdAt.toISOString(),
    };
  }

  /**
   * Elenco playlist create dall'utente
   */
  async getUserPlaylists(userId: string, viewerId: string | null): Promise<PlaylistSummary[]> {
    const playlists = await this.prisma.playlist.findMany({
      where: { userId, ...(viewerId === userId ? {} : { isPublic: true }) },
      include: {
        _count: { select: { tracks: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return playlists.map((p) => ({
      id: p.id,
      title: p.title,
      description: p.description,
      coverUrl: p.coverUrl,
      isPublic: p.isPublic,
      trackCount: p._count.tracks,
      createdAt: p.createdAt.toISOString(),
    }));
  }
}
