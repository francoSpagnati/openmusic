import type { PrismaClient } from '@openmusic/db';
import { ConflictError, NotFoundError } from '../../lib/errors';
import type Redis from 'ioredis';
import type { SpotifyService } from '../auth/spotify.service';
import type { NowPlayingService } from '../now-playing/now-playing.service';
import type {
  SpotifyTrackItem,
  SpotifyTopArtist,
  SpotifyRecentlyPlayedItem,
  ExportPlaylistInput,
  ExportPlaylistResponse,
  SpotifySyncPlaybackResponse,
  NowPlayingTrack,
} from '@openmusic/shared';

export class SpotifySyncService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly spotifyService: SpotifyService,
    private readonly nowPlayingService: NowPlayingService
  ) {}

  /**
   * Recupera un token di accesso valido per l'utente, rinnovandolo automaticamente se scaduto
   */
  async getValidAccessToken(
    userId: string
  ): Promise<{ accessToken: string; spotifyUserId: string }> {
    const account = await this.prisma.connectedAccount.findFirst({
      where: {
        userId,
        provider: 'SPOTIFY',
      },
    });

    if (!account) {
      throw new ConflictError('Nessun account Spotify collegato');
    }

    const now = Date.now();
    const isExpired = account.expiresAt ? account.expiresAt.getTime() - now < 60000 : false;

    if (!isExpired) {
      return {
        accessToken: account.accessToken,
        spotifyUserId: account.providerId,
      };
    }

    if (!account.refreshToken) {
      throw new ConflictError('Sessione Spotify scaduta: ricollega il tuo account Spotify');
    }

    // Rinnovo token tramite refresh_token
    const refreshed = await this.spotifyService.refreshAccessToken(account.refreshToken);
    const newExpiresAt = new Date(now + refreshed.expiresIn * 1000);

    await this.prisma.connectedAccount.update({
      where: { id: account.id },
      data: {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ?? account.refreshToken,
        expiresAt: newExpiresAt,
      },
    });

    return {
      accessToken: refreshed.accessToken,
      spotifyUserId: account.providerId,
    };
  }

  /**
   * Sincronizza lo stato di riproduzione corrente dell'utente con Redis, Socket.io e ScrobbleLog
   */
  async syncUserPlayback(userId: string): Promise<SpotifySyncPlaybackResponse> {
    const { accessToken } = await this.getValidAccessToken(userId);
    const current = await this.spotifyService.getCurrentlyPlaying(accessToken);

    if (!current || !current.track || !current.isPlaying) {
      return {
        synced: true,
        isPlaying: false,
        track: null,
        loggedScrobble: false,
        message: 'Nessuna riproduzione attiva al momento su Spotify',
      };
    }

    const { track, progressMs } = current;

    // 1. Aggiorna lo stato Real-Time in Redis per la Live Friends Bar
    const nowPlayingPayload: NowPlayingTrack = {
      trackId: track.id,
      title: track.title,
      artistName: track.artist,
      albumTitle: track.album,
      coverUrl: track.coverUrl ?? undefined,
      dominantColor: '#D97736',
      durationMs: track.durationMs,
      progressMs,
      isrc: track.isrc ?? undefined,
      provider: 'SPOTIFY',
      isPlaying: true,
      updatedAt: Date.now(),
    };

    await this.nowPlayingService.updateUserNowPlaying(userId, nowPlayingPayload);

    // 2. Controllo scrobble per il badge "Ascolto Verificato" (ADR-004)
    // Criterio standard: brano ascoltato per almeno il 50% o per più di 30 secondi
    let loggedScrobble = false;
    const isEligibleForScrobble =
      progressMs > 30000 || (track.durationMs > 0 && progressMs / track.durationMs >= 0.5);

    if (isEligibleForScrobble) {
      // Evita duplicati controllando se è già stato registrato uno scrobble negli ultimi 3 minuti
      const recentScrobbleKey = `scrobble:dedup:${userId}:${track.id}`;
      const alreadyLogged = await this.redis.get(recentScrobbleKey);

      if (!alreadyLogged) {
        // Cerca o crea la traccia nel DB locale
        let dbTrack = await this.prisma.track.findFirst({
          where: {
            OR: [...(track.isrc ? [{ isrc: track.isrc }] : []), { spotifyId: track.id }],
          },
        });

        if (!dbTrack) {
          // Trova o crea la Release correlata
          let release = await this.prisma.release.findFirst({
            where: {
              title: track.album || 'Single',
              artistName: track.artist,
            },
          });

          if (!release) {
            release = await this.prisma.release.create({
              data: {
                title: track.album || 'Single',
                artistName: track.artist,
                coverUrl: track.coverUrl,
                dominantColor: '#D97736',
              },
            });
          }

          dbTrack = await this.prisma.track.create({
            data: {
              title: track.title,
              artistName: track.artist,
              isrc: track.isrc,
              spotifyId: track.id,
              durationMs: track.durationMs,
              releaseId: release.id,
            },
          });
        }

        // Registra ScrobbleLog
        await this.prisma.scrobbleLog.create({
          data: {
            userId,
            trackId: dbTrack.id,
            releaseId: dbTrack.releaseId,
            provider: 'SPOTIFY',
            playedAt: new Date(),
          },
        });

        // Imposta chiave di deduplicazione con TTL di 3 minuti (180s)
        await this.redis.setex(recentScrobbleKey, 180, '1');
        loggedScrobble = true;
      }
    }

    return {
      synced: true,
      isPlaying: true,
      track,
      loggedScrobble,
      message: loggedScrobble
        ? 'Riproduzione sincronizzata e ascolto verificato registrato con successo'
        : 'Riproduzione sincronizzata in tempo reale con la Live Friends Bar',
    };
  }

  /**
   * Recupera i brani in rotazione pesante dell'utente (Top Tracks), con caching in Redis
   */
  async getHeavyRotation(
    userId: string,
    timeRange: 'short_term' | 'medium_term' | 'long_term' = 'short_term'
  ): Promise<SpotifyTrackItem[]> {
    const cacheKey = `user:${userId}:heavy_rotation:${timeRange}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) {
      return JSON.parse(cached) as SpotifyTrackItem[];
    }

    const { accessToken } = await this.getValidAccessToken(userId);
    const tracks = await this.spotifyService.getTopTracks(accessToken, timeRange, 5);

    // Salva in cache per 1 ora (3600s)
    await this.redis.setex(cacheKey, 3600, JSON.stringify(tracks));
    return tracks;
  }

  /**
   * Recupera la cronologia recente di ascolto
   */
  async getRecentlyPlayed(
    userId: string,
    limit: number = 20
  ): Promise<SpotifyRecentlyPlayedItem[]> {
    const { accessToken } = await this.getValidAccessToken(userId);
    return this.spotifyService.getRecentlyPlayed(accessToken, limit);
  }

  /**
   * Recupera gli artisti preferiti
   */
  async getTopArtists(
    userId: string,
    timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term'
  ): Promise<SpotifyTopArtist[]> {
    const { accessToken } = await this.getValidAccessToken(userId);
    return this.spotifyService.getTopArtists(accessToken, timeRange, 10);
  }

  /**
   * Esporta una playlist vinilica creata su OpenMusic (Lato A + Lato B) direttamente su Spotify
   */
  async exportPlaylistToSpotify(
    userId: string,
    input: ExportPlaylistInput
  ): Promise<ExportPlaylistResponse> {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id: input.playlistId },
      include: {
        tracks: {
          include: { track: true },
          orderBy: [{ side: 'asc' }, { position: 'asc' }],
        },
      },
    });

    if (!playlist || (!playlist.isPublic && playlist.userId !== userId)) {
      throw new NotFoundError('Playlist non trovata');
    }

    const { accessToken, spotifyUserId } = await this.getValidAccessToken(userId);

    const playlistName = input.customName ?? `${playlist.title} (OpenMusic Vinyl)`;
    const playlistDescription =
      input.description ??
      (playlist.description
        ? `${playlist.description} — Esportata da OpenMusic`
        : 'Playlist analogica (Lato A / Lato B) esportata da OpenMusic');

    // 1. Crea la playlist sull'account Spotify dell'utente
    const created = await this.spotifyService.createPlaylist(
      accessToken,
      spotifyUserId,
      playlistName,
      playlistDescription,
      input.isPublic
    );

    // 2. Risolvi gli Spotify URI di ogni traccia (ISRC o spotifyId o ricerca)
    const spotifyUris: string[] = [];
    let unmatched = 0;

    for (const item of playlist.tracks) {
      if (item.track.spotifyId) {
        spotifyUris.push(`spotify:track:${item.track.spotifyId}`);
      } else if (item.track.isrc) {
        const results = await this.spotifyService.searchTracks(
          accessToken,
          `isrc:${item.track.isrc}`,
          1
        );
        if (results.length > 0 && results[0]?.spotifyUri) {
          spotifyUris.push(results[0].spotifyUri);
        } else {
          unmatched++;
        }
      } else {
        const results = await this.spotifyService.searchTracks(
          accessToken,
          `track:${item.track.title} artist:${item.track.artistName}`,
          1
        );
        if (results.length > 0 && results[0]?.spotifyUri) {
          spotifyUris.push(results[0].spotifyUri);
        } else {
          unmatched++;
        }
      }
    }

    // 3. Aggiunge le tracce alla nuova playlist creata
    if (spotifyUris.length > 0) {
      await this.spotifyService.addTracksToPlaylist(accessToken, created.id, spotifyUris);
    }

    return {
      spotifyPlaylistId: created.id,
      spotifyPlaylistUrl: created.externalUrl,
      playlistName,
      tracksAddedCount: spotifyUris.length,
      unmatchedTracksCount: unmatched,
    };
  }
}
