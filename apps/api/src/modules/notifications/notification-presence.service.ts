import type { NotificationPresenceSummary, ActiveListeningFriendSummary } from '@openmusic/shared';
import type { NowPlayingService } from '../now-playing/now-playing.service';

export class NotificationPresenceService {
  constructor(private readonly nowPlayingService: NowPlayingService) {}

  /**
   * ADR-004: summary payload for the persistent OS notification
   * (Android ongoing notification / iOS Live Activity).
   */
  async getPresenceSummary(userId: string): Promise<NotificationPresenceSummary> {
    const friends = await this.nowPlayingService.getFriendsLivePresence(userId);

    const active = friends.flatMap((f) =>
      f.isOnline && !f.isGhostMode && f.currentlyPlaying?.isPlaying
        ? [{ friend: f, track: f.currentlyPlaying }]
        : []
    );

    const topListeningFriends: ActiveListeningFriendSummary[] = active
      .slice(0, 3)
      .map(({ friend, track }) => ({
        userId: friend.userId,
        username: friend.username,
        avatarUrl: friend.avatarUrl ?? null,
        trackTitle: track.title,
        artistName: track.artistName,
        dominantColor: track.dominantColor,
      }));

    return {
      activeFriendsCount: active.length,
      topListeningFriends,
      timestamp: Date.now(),
    };
  }
}
