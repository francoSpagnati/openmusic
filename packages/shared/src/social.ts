import { z } from 'zod';
import { CatalogTrackSchema } from './catalog';

// ==========================================
// 1. CHAT MUSICALE & TRADUZIONE UNIVERSALE ISRC
// ==========================================

export const ChatReactionTypeSchema = z.enum(['FIRE', 'HEART', 'NOT_FOR_ME']);

export const UniversalTrackLinksSchema = z.object({
  spotify: z.string().url().nullable().optional(),
  appleMusic: z.string().url().nullable().optional(),
  deezer: z.string().url().nullable().optional(),
  openmusic: z.string().url(),
});

export const ChatMessageSchema = z.object({
  id: z.string().uuid(),
  senderId: z.string().uuid(),
  receiverId: z.string().uuid(),
  content: z.string().nullable().optional(),
  track: CatalogTrackSchema.nullable().optional(),
  universalLinks: UniversalTrackLinksSchema.nullable().optional(),
  isListened: z.boolean().default(false),
  reaction: ChatReactionTypeSchema.nullable().optional(),
  createdAt: z.string(),
});

export const SendMessageInputSchema = z.object({
  receiverId: z.string().uuid(),
  content: z.string().max(1000).optional(),
  trackId: z.string().optional(),
});

export const ReactToMessageInputSchema = z.object({
  messageId: z.string().uuid(),
  reaction: ChatReactionTypeSchema.nullable(),
});

// ==========================================
// 2. PLAYLIST TEMATICHE (LATO A / LATO B)
// ==========================================

export const PlaylistSideSchema = z.enum(['A', 'B']);

export const PlaylistTrackItemSchema = z.object({
  id: z.string().uuid(),
  track: CatalogTrackSchema,
  side: PlaylistSideSchema,
  position: z.number().int(),
  addedAt: z.string(),
});

export const PlaylistDetailsSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  user: z.object({
    id: z.string().uuid(),
    username: z.string(),
    displayName: z.string().nullable(),
  }),
  title: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  coverUrl: z.string().url().nullable().optional(),
  isPublic: z.boolean(),
  sideATracks: z.array(PlaylistTrackItemSchema),
  sideBTracks: z.array(PlaylistTrackItemSchema),
  totalDurationMs: z.number().int(),
  createdAt: z.string(),
});

export const CreatePlaylistInputSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().default(true),
});

export const AddTrackToPlaylistInputSchema = z.object({
  playlistId: z.string().uuid(),
  trackId: z.string(),
  side: PlaylistSideSchema.default('A'),
});

// ==========================================
// 3. NOTIFICA PERSISTENTE OS (ADR-002)
// ==========================================

export const ActiveListeningFriendSummarySchema = z.object({
  userId: z.string().uuid(),
  username: z.string(),
  avatarUrl: z.string().url().nullable().optional(),
  trackTitle: z.string(),
  artistName: z.string(),
  dominantColor: z.string().default('#26262B'),
});

export const NotificationPresenceSummarySchema = z.object({
  activeFriendsCount: z.number().int(),
  topListeningFriends: z.array(ActiveListeningFriendSummarySchema),
  timestamp: z.number(),
});

export type ChatReactionType = z.infer<typeof ChatReactionTypeSchema>;
export type UniversalTrackLinks = z.infer<typeof UniversalTrackLinksSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type SendMessageInput = z.infer<typeof SendMessageInputSchema>;
export type ReactToMessageInput = z.infer<typeof ReactToMessageInputSchema>;

export type PlaylistSide = z.infer<typeof PlaylistSideSchema>;
export type PlaylistTrackItem = z.infer<typeof PlaylistTrackItemSchema>;
export type PlaylistDetails = z.infer<typeof PlaylistDetailsSchema>;
export type CreatePlaylistInput = z.infer<typeof CreatePlaylistInputSchema>;
export type AddTrackToPlaylistInput = z.infer<typeof AddTrackToPlaylistInputSchema>;

export type ActiveListeningFriendSummary = z.infer<typeof ActiveListeningFriendSummarySchema>;
export type NotificationPresenceSummary = z.infer<typeof NotificationPresenceSummarySchema>;
