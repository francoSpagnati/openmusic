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
  readAt: z.string().nullable(),
  createdAt: z.string(),
});

export const SendMessageInputSchema = z
  .object({
    receiverId: z.string().uuid(),
    content: z.string().trim().max(1000).optional(),
    trackId: z.string().uuid().optional(),
  })
  .refine((m) => (m.content !== undefined && m.content.length > 0) || m.trackId !== undefined, {
    message: 'Il messaggio deve contenere testo o un brano',
    path: ['content'],
  });

export const MarkListenedInputSchema = z.object({
  messageId: z.string().uuid(),
});

/** Path param for `/api/chat/conversation/:otherUserId`. */
export const ConversationParamSchema = z.object({ otherUserId: z.string().uuid() });

/** One row of the chat inbox (`GET /api/chat/conversations`). */
export const ConversationSummarySchema = z.object({
  otherUser: z.object({
    id: z.string().uuid(),
    username: z.string(),
    displayName: z.string().nullable(),
    avatarUrl: z.string().url().nullable(),
  }),
  lastMessage: ChatMessageSchema,
  /** Messages from `otherUser` not yet read by the viewer. */
  unreadCount: z.number().int().nonnegative(),
});

export const ConversationListSchema = z.array(ConversationSummarySchema);

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
  trackId: z.string().uuid(),
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

export const PlaylistSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  coverUrl: z.string().nullable(),
  isPublic: z.boolean(),
  trackCount: z.number().int().nonnegative(),
  createdAt: z.string(),
});

export type MarkListenedInput = z.infer<typeof MarkListenedInputSchema>;
export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;
export type PlaylistSummary = z.infer<typeof PlaylistSummarySchema>;
export type ChatReactionType = z.infer<typeof ChatReactionTypeSchema>;
export type UniversalTrackLinks = z.infer<typeof UniversalTrackLinksSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type SendMessageInput = z.input<typeof SendMessageInputSchema>;
export type ReactToMessageInput = z.infer<typeof ReactToMessageInputSchema>;

export type PlaylistSide = z.infer<typeof PlaylistSideSchema>;
export type PlaylistTrackItem = z.infer<typeof PlaylistTrackItemSchema>;
export type PlaylistDetails = z.infer<typeof PlaylistDetailsSchema>;
export type CreatePlaylistInput = z.input<typeof CreatePlaylistInputSchema>;
export type AddTrackToPlaylistInput = z.input<typeof AddTrackToPlaylistInputSchema>;

export type ActiveListeningFriendSummary = z.infer<typeof ActiveListeningFriendSummarySchema>;
export type NotificationPresenceSummary = z.infer<typeof NotificationPresenceSummarySchema>;
