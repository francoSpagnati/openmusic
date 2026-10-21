import { z } from 'zod';

export const MusicProviderSchema = z.enum([
  'SPOTIFY',
  'APPLE_MUSIC',
  'LASTFM',
  'OS_MEDIA_SESSION', // Rilevamento nativo Android/iOS di qualsiasi player
]);

export const NowPlayingTrackSchema = z.object({
  trackId: z.string().optional(),
  isrc: z.string().optional(), // Chiave universale per tradurre link tra Spotify e Apple Music
  title: z.string().min(1),
  artistName: z.string().min(1),
  albumTitle: z.string().optional(),
  coverUrl: z.string().url().optional(),
  dominantColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default('#26262B'),
  durationMs: z.number().int().positive(),
  progressMs: z.number().int().nonnegative(),
  previewUrl: z.string().url().optional(), // Clip 30s (Spotify -> Deezer -> iTunes fallback)
  provider: MusicProviderSchema,
  isPlaying: z.boolean(),
  updatedAt: z.number(), // Unix timestamp ms
});

export const FriendPresenceSchema = z.object({
  userId: z.string().uuid(),
  username: z.string(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  isOnline: z.boolean(),
  isGhostMode: z.boolean(), // Euristica #3 di Nielsen: Controllo e Libertà dell'utente
  currentlyPlaying: NowPlayingTrackSchema.nullable(),
});

// Payload per il cambio istantaneo di Ghost Mode
export const ToggleGhostModeSchema = z.object({
  isGhostMode: z.boolean(),
});

export type MusicProvider = z.infer<typeof MusicProviderSchema>;
export type NowPlayingTrack = z.infer<typeof NowPlayingTrackSchema>;
export type FriendPresence = z.infer<typeof FriendPresenceSchema>;

// Nomi standard degli eventi WebSocket per evitare typo tra Backend e Frontend
export const WS_EVENTS = {
  CLIENT_UPDATE_TRACK: 'now_playing:update_track',
  CLIENT_TOGGLE_GHOST: 'now_playing:toggle_ghost',
  SERVER_FRIEND_PRESENCE_CHANGED: 'now_playing:friend_presence_changed',
  SERVER_INITIAL_FRIENDS_STATE: 'now_playing:initial_friends_state',
  SERVER_NOTIFICATION: 'notification:new',
  SERVER_CHAT_MESSAGE: 'chat:message',
} as const;
