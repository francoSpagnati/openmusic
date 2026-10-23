import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import type { PrismaClient } from '@openmusic/db';
import { ConflictError, NotFoundError, UpstreamError } from '../../lib/errors';
import type Redis from 'ioredis';
import { SpotifyTokenRevokedError, type SpotifyService } from '../auth/spotify.service';
import type { NowPlayingService } from '../now-playing/now-playing.service';
import type { ProviderSyncStore } from '../now-playing/provider-sync.store';
import type { ListenedTrack, ScrobbleRecorder } from '../now-playing/scrobble-recorder';
import type {
  SpotifyTrackItem,
  SpotifyTopArtist,
  SpotifyRecentlyPlayedItem,
  ExportPlaylistInput,
  ExportPlaylistResponse,
  SpotifySyncPlaybackResponse,
  NowPlayingTrack,
} from '@openmusic/shared';

/** One Spotify token refresh per account at a time (ms); longer than the 5 s upstream timeout. */
const REFRESH_LOCK_MS = 10_000;
/** How long a concurrent caller waits for that refresh before giving up (transient error). */
const REFRESH_WAIT_MS = 8_000;
const REFRESH_POLL_MS = 100;
const RELEASE_LOCK_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0`;

/** Listen long enough to count (ADR-002): more than 30 s, or at least half of the track. */
export function isScrobbleEligible(progressMs: number, durationMs: number): boolean {
  return progressMs > 30_000 || (durationMs > 0 && progressMs / durationMs >= 0.5);
}

export function spotifyListenedTrack(track: SpotifyTrackItem): ListenedTrack {
  return {
    provider: 'SPOTIFY',
    title: track.title,
    artist: track.artist,
    album: track.album || null,
    coverUrl: track.coverUrl,
    isrc: track.isrc,
    spotifyId: track.id,
    durationMs: track.durationMs,
  };
}

export class SpotifySyncService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly redis: Redis,
    private readonly spotifyService: SpotifyService,
    private readonly nowPlayingService: NowPlayingService,
    private readonly scrobbles: ScrobbleRecorder,
    private readonly syncStore: ProviderSyncStore
  ) {}

  /**
   * Recupera un token di accesso valido per l'utente, rinnovandolo automaticamente se scaduto
   * (o sempre, con `forceRefresh`, dopo un 401). Un refresh token revocato porta l'account in
   * stato ERROR (ADR-013: il poller smette di leggerlo finché non viene ricollegato).
   *
   * Il poller, "Sincronizza ora" e le altre rotte Spotify possono chiedere un refresh nello stesso
   * momento: un lock Redis per account fa sì che parta un solo refresh; gli altri aspettano e
   * riusano il token salvato. Se Spotify ruota il refresh token, un secondo refresh con quello
   * vecchio riceverebbe `invalid_grant` e l'account finirebbe in ERROR per errore.
   */
  async getValidAccessToken(
    userId: string,
    options: { forceRefresh?: boolean; rejectedToken?: string } = {}
  ): Promise<{ accessToken: string; spotifyUserId: string }> {
    let account = await this.loadSpotifyAccount(userId);
    if (!this.needsRefresh(account, options)) {
      return { accessToken: account.accessToken, spotifyUserId: account.providerId };
    }

    const lockKey = `spotify:refresh:${account.id}`;
    const lockToken = randomUUID();
    const locked = await this.redis
      .set(lockKey, lockToken, 'PX', REFRESH_LOCK_MS, 'NX')
      .then((ok) => ok === 'OK')
      // Redis down: refresh without the lock rather than failing every Spotify call.
      .catch(() => true);

    if (!locked) {
      // Another request is refreshing: wait for the token it stores.
      const seen = account.accessToken;
      const deadline = Date.now() + REFRESH_WAIT_MS;
      while (Date.now() < deadline) {
        await sleep(REFRESH_POLL_MS);
        account = await this.loadSpotifyAccount(userId);
        if (account.accessToken !== seen && !this.isExpired(account)) {
          return { accessToken: account.accessToken, spotifyUserId: account.providerId };
        }
        // The other refresh found the refresh token revoked.
        if (account.syncStatus === 'ERROR' && account.syncError === 'TOKEN_REVOKED') {
          throw new SpotifyTokenRevokedError();
        }
      }
      throw new UpstreamError('Spotify', 'Spotify token refresh still in progress');
    }

    try {
      // Re-read under the lock: a refresh may have completed between our read and the lock.
      account = await this.loadSpotifyAccount(userId);
      if (!this.needsRefresh(account, options)) {
        return { accessToken: account.accessToken, spotifyUserId: account.providerId };
      }
      const usedRefreshToken = account.refreshToken;
      try {
        if (!usedRefreshToken) throw new SpotifyTokenRevokedError();
        const now = Date.now();
        const refreshed = await this.spotifyService.refreshAccessToken(usedRefreshToken);
        await this.prisma.connectedAccount.update({
          where: { id: account.id },
          data: {
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken ?? usedRefreshToken,
            expiresAt: new Date(now + refreshed.expiresIn * 1000),
          },
        });
        return { accessToken: refreshed.accessToken, spotifyUserId: account.providerId };
      } catch (err) {
        if (err instanceof SpotifyTokenRevokedError) {
          // Lock expired or Redis was down: someone else may have rotated the refresh token
          // meanwhile. Only a refusal of the CURRENT refresh token means revoked.
          const latest = await this.loadSpotifyAccount(userId);
          if (latest.refreshToken && latest.refreshToken !== usedRefreshToken) {
            return { accessToken: latest.accessToken, spotifyUserId: latest.providerId };
          }
          await this.syncStore.markErrorFor(userId, 'SPOTIFY', 'TOKEN_REVOKED');
        }
        throw err;
      }
    } finally {
      await this.redis.eval(RELEASE_LOCK_SCRIPT, 1, lockKey, lockToken).catch(() => undefined);
    }
  }

  private async loadSpotifyAccount(userId: string) {
    const account = await this.prisma.connectedAccount.findFirst({
      where: { userId, provider: 'SPOTIFY' },
    });
    if (!account) throw new ConflictError('Nessun account Spotify collegato');
    return account;
  }

  private isExpired(account: { expiresAt: Date | null }): boolean {
    return account.expiresAt ? account.expiresAt.getTime() - Date.now() < 60_000 : false;
  }

  /**
   * Expired, or a forced refresh after a 401. A 401 on a token that is no longer the stored one
   * (`rejectedToken`) needs no refresh: someone already replaced it.
   */
  private needsRefresh(
    account: { accessToken: string; expiresAt: Date | null },
    options: { forceRefresh?: boolean; rejectedToken?: string }
  ): boolean {
    if (this.isExpired(account)) return true;
    if (!options.forceRefresh) return false;
    return options.rejectedToken === undefined || options.rejectedToken === account.accessToken;
  }

  /**
   * Sincronizza lo stato di riproduzione corrente dell'utente con Redis, Socket.io e ScrobbleLog
   * (sincronizzazione manuale, "Sincronizza ora"; quella automatica è il poller di ADR-013).
   */
  async syncUserPlayback(userId: string): Promise<SpotifySyncPlaybackResponse> {
    const { accessToken } = await this.getValidAccessToken(userId);
    const current = await this.spotifyService.getCurrentlyPlaying(accessToken);
    await this.syncStore.markSuccessFor(userId, 'SPOTIFY');

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

    // 2. Controllo scrobble per il badge "Ascolto Verificato" (ADR-002), con deduplica di 3 minuti
    let loggedScrobble = false;
    const listened = spotifyListenedTrack(track);
    if (
      isScrobbleEligible(progressMs, track.durationMs) &&
      (await this.scrobbles.claim(userId, listened))
    ) {
      await this.scrobbles.record(userId, listened, new Date());
      loggedScrobble = true;
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
