import type { PrismaClient } from '@prisma/client';
import type {
  PlaylistDetails,
  CreatePlaylistInput,
  AddTrackToPlaylistInput,
  PlaylistTrackItem,
} from '@openmusic/shared';

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

    if (!playlist || playlist.userId !== userId) {
      throw new Error('Playlist non trovata o permessi insufficienti');
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

    return this.getPlaylistDetails(playlistId);
  }

  /**
   * Restituisce i dettagli completi con tracce divise per Lato A e Lato B
   */
  async getPlaylistDetails(playlistId: string): Promise<PlaylistDetails> {
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

    if (!playlist) {
      throw new Error('Playlist non trovata');
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
        track: {
          id: item.track.id,
          isrc: item.track.isrc,
          title: item.track.title,
          artistName: item.track.artistName,
          durationMs: item.track.durationMs,
          previewUrl: item.track.previewUrl,
          releaseId: item.track.releaseId,
          coverUrl: item.track.release.coverUrl,
        },
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
  async getUserPlaylists(userId: string) {
    const playlists = await this.prisma.playlist.findMany({
      where: { userId },
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
