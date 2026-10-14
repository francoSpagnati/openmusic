import { z } from 'zod';

// Spotify Track representation
export const SpotifyTrackItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  artist: z.string(),
  album: z.string(),
  coverUrl: z.string().nullable(),
  isrc: z.string().nullable(),
  durationMs: z.number(),
  spotifyUri: z.string(),
  externalUrl: z.string(),
  popularity: z.number().default(0),
});
export type SpotifyTrackItem = z.infer<typeof SpotifyTrackItemSchema>;

// Spotify Currently Playing state
export const SpotifyCurrentlyPlayingSchema = z.object({
  isPlaying: z.boolean(),
  track: SpotifyTrackItemSchema.nullable(),
  progressMs: z.number(),
  timestamp: z.number(),
});
export type SpotifyCurrentlyPlaying = z.infer<typeof SpotifyCurrentlyPlayingSchema>;

// Spotify Top Artist representation
export const SpotifyTopArtistSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatarUrl: z.string().nullable(),
  genres: z.array(z.string()),
  popularity: z.number(),
});
export type SpotifyTopArtist = z.infer<typeof SpotifyTopArtistSchema>;

// Recently Played Item
export const SpotifyRecentlyPlayedItemSchema = z.object({
  track: SpotifyTrackItemSchema,
  playedAt: z.string(),
});
export type SpotifyRecentlyPlayedItem = z.infer<typeof SpotifyRecentlyPlayedItemSchema>;

// Export Playlist Request Schema
export const ExportPlaylistInputSchema = z.object({
  playlistId: z.string(),
  customName: z.string().optional(),
  description: z.string().optional(),
  isPublic: z.boolean().default(true),
});
export type ExportPlaylistInput = z.infer<typeof ExportPlaylistInputSchema>;

// Export Playlist Response
export const ExportPlaylistResponseSchema = z.object({
  spotifyPlaylistId: z.string(),
  spotifyPlaylistUrl: z.string(),
  playlistName: z.string(),
  tracksAddedCount: z.number(),
  unmatchedTracksCount: z.number(),
});
export type ExportPlaylistResponse = z.infer<typeof ExportPlaylistResponseSchema>;

// Sync Playback Response
export const SpotifySyncPlaybackResponseSchema = z.object({
  synced: z.boolean(),
  isPlaying: z.boolean(),
  track: SpotifyTrackItemSchema.nullable(),
  loggedScrobble: z.boolean(),
  message: z.string(),
});
export type SpotifySyncPlaybackResponse = z.infer<typeof SpotifySyncPlaybackResponseSchema>;
