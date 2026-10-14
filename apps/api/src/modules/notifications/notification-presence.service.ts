import type { NowPlayingService } from '../now-playing/now-playing.service';
import type { NotificationPresenceSummary, ActiveListeningFriendSummary } from '@openmusic/shared';

export class NotificationPresenceService {
  constructor(private readonly nowPlayingService: NowPlayingService) {}

  /**
   * ADR-002: Genera il payload di sintesi per la notifica persistente di sistema
   * (Ongoing Notification su Android / Live Activity su iOS)
   */
  async getPresenceSummary(userId: string): Promise<NotificationPresenceSummary> {
    const friends = await this.nowPlayingService.getFriendsLivePresence(userId);

    // Filtra amici online che stanno effettivamente riproducendo musica (non in Ghost Mode)
    const activeFriends = friends.filter(
      (f) => f.isOnline && !f.isGhostMode && f.currentlyPlaying?.isPlaying
    );

    const topListeningFriends: ActiveListeningFriendSummary[] = activeFriends.slice(0, 3).map((f) => ({
      userId: f.userId,
      username: f.username,
      avatarUrl: f.avatarUrl ?? null,
      trackTitle: f.currentlyPlaying!.title,
      artistName: f.currentlyPlaying!.artistName,
      dominantColor: f.currentlyPlaying!.dominantColor ?? '#26262B',
    }));

    return {
      activeFriendsCount: activeFriends.length,
      topListeningFriends,
      timestamp: Date.now(),
    };
  }
}
