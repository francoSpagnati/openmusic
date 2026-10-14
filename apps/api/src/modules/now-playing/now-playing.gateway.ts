import type { Server, Socket } from 'socket.io';
import {
  WS_EVENTS,
  ToggleGhostModeSchema,
} from '@openmusic/shared';
import type { NowPlayingService } from './now-playing.service';

export function registerNowPlayingGateway(
  io: Server,
  nowPlayingService: NowPlayingService
): void {
  io.on('connection', async (socket: Socket) => {
    const userId = socket.handshake.auth.userId as string | undefined;
    if (!userId) {
      socket.disconnect();
      return;
    }

    // L'utente entra nella propria stanza personale per ricevere aggiornamenti mirati
    socket.join(`user:${userId}`);

    // 1. Invia subito lo stato iniziale degli amici online (Euristica #1: Visibilità stato)
    const initialFriends = await nowPlayingService.getFriendsLivePresence(userId);
    socket.emit(WS_EVENTS.SERVER_INITIAL_FRIENDS_STATE, initialFriends);

    // 2. Quando l'utente cambia canzone (da Spotify, Last.fm o OS Media Session)
    socket.on(WS_EVENTS.CLIENT_UPDATE_TRACK, async (payload: unknown) => {
      try {
        const updatedPresence = await nowPlayingService.updateUserNowPlaying(
          userId,
          payload
        );
        if (updatedPresence) {
          socket.broadcast.emit(WS_EVENTS.SERVER_FRIEND_PRESENCE_CHANGED, updatedPresence);
        }
      } catch (err) {
        // Non disconnettiamo il client per un payload malformato: logghiamo in sicurezza
        console.error('[NowPlayingGateway] Invalid track payload:', err);
      }
    });

    // 3. Quando l'utente preme il toggle "Ghost Mode" nella barra superiore
    socket.on(WS_EVENTS.CLIENT_TOGGLE_GHOST, async (payload: unknown) => {
      try {
        const { isGhostMode } = ToggleGhostModeSchema.parse(payload);
        const updatedPresence = await nowPlayingService.setGhostMode(userId, isGhostMode);
        if (updatedPresence) {
          socket.broadcast.emit(WS_EVENTS.SERVER_FRIEND_PRESENCE_CHANGED, updatedPresence);
        }
      } catch (err) {
        console.error('[NowPlayingGateway] Failed to toggle Ghost Mode:', err);
      }
    });
  });
}