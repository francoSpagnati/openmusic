import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@openmusic/shared';

export type OpenMusicIo = Server<ClientToServerEvents, ServerToClientEvents>;

export function userRoom(userId: string): string {
  return `user:${userId}`;
}

/** Pushes server events to specific users' sockets. Services depend on this, not on Socket.io. */
export interface RealtimeEmitter {
  toUsers<E extends keyof ServerToClientEvents>(
    userIds: readonly string[],
    event: E,
    ...args: Parameters<ServerToClientEvents[E]>
  ): void;
}

export function createRealtimeEmitter(io: OpenMusicIo): RealtimeEmitter {
  return {
    toUsers(userIds, event, ...args) {
      if (userIds.length === 0) return;
      io.to(userIds.map(userRoom)).emit(event, ...args);
    },
  };
}
