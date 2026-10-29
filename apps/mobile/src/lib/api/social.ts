// Mirrors apps/web/src/lib/api/social.ts (same endpoints, Bearer-authenticated client).
import { z } from 'zod';
import {
  ChatMessageSchema,
  ConversationListSchema,
  FollowStateSchema,
  FriendPresenceSchema,
  NowPlayingSyncStatusSchema,
  NotificationPageSchema,
  NotificationPresenceSummarySchema,
  PostLikeStateSchema,
  PostPageSchema,
  PostSaveStateSchema,
  PostSchema,
  UnreadCountSchema,
  UserSummaryPageSchema,
  UserSuggestionListSchema,
  type ChatMessage,
  type ConversationSummary,
  type CreatePostInput,
  type CursorQuery,
  type FeedQuery,
  type FollowState,
  type FriendPresence,
  type NowPlayingSyncStatus,
  type NotificationPage,
  type NotificationPresenceSummary,
  type NotificationsQuery,
  type Post,
  type PostLikeState,
  type PostPage,
  type PostSaveState,
  type ChatReactionType,
  type SendMessageInput,
  type UserSearchQuery,
  type UserSuggestionsQuery,
  type UserSummary,
  type UserSummaryPage,
} from '@openmusic/shared';
import { apiRequest } from './client';

type PageParams = Partial<Pick<CursorQuery, 'cursor' | 'limit'>>;

const UpdatedCountSchema = z.object({ updated: z.number().int() });

export const usersApi = {
  search: (query: UserSearchQuery): Promise<UserSummaryPage> =>
    apiRequest('/api/users/search', { query: { ...query }, schema: UserSummaryPageSchema }),

  /** "Who to follow": popular users the viewer does not follow yet. */
  suggestions: (query: UserSuggestionsQuery = {}): Promise<UserSummary[]> =>
    apiRequest('/api/users/suggestions', { query: { ...query }, schema: UserSuggestionListSchema }),

  followers: (userId: string, page: PageParams = {}): Promise<UserSummaryPage> =>
    apiRequest(`/api/users/${userId}/followers`, { query: page, schema: UserSummaryPageSchema }),

  following: (userId: string, page: PageParams = {}): Promise<UserSummaryPage> =>
    apiRequest(`/api/users/${userId}/following`, { query: page, schema: UserSummaryPageSchema }),

  follow: (userId: string): Promise<FollowState> =>
    apiRequest(`/api/users/${userId}/follow`, { method: 'PUT', schema: FollowStateSchema }),

  unfollow: (userId: string): Promise<FollowState> =>
    apiRequest(`/api/users/${userId}/follow`, { method: 'DELETE', schema: FollowStateSchema }),

  posts: (userId: string, page: PageParams = {}): Promise<PostPage> =>
    apiRequest(`/api/users/${userId}/posts`, { query: page, schema: PostPageSchema }),
};

export const feedApi = {
  /** Home feed. Anonymous visitors always receive the global feed. */
  list: (query: FeedQuery = {}): Promise<PostPage> =>
    apiRequest('/api/feed', { query: { ...query }, schema: PostPageSchema }),

  get: (postId: string): Promise<Post> =>
    apiRequest(`/api/posts/${postId}`, { schema: PostSchema }),

  create: (input: CreatePostInput): Promise<Post> =>
    apiRequest('/api/posts', { method: 'POST', body: input, schema: PostSchema }),

  remove: (postId: string): Promise<void> =>
    apiRequest(`/api/posts/${postId}`, { method: 'DELETE' }),

  like: (postId: string): Promise<PostLikeState> =>
    apiRequest(`/api/posts/${postId}/like`, { method: 'PUT', schema: PostLikeStateSchema }),

  unlike: (postId: string): Promise<PostLikeState> =>
    apiRequest(`/api/posts/${postId}/like`, { method: 'DELETE', schema: PostLikeStateSchema }),

  save: (postId: string): Promise<PostSaveState> =>
    apiRequest(`/api/posts/${postId}/save`, { method: 'PUT', schema: PostSaveStateSchema }),

  unsave: (postId: string): Promise<PostSaveState> =>
    apiRequest(`/api/posts/${postId}/save`, { method: 'DELETE', schema: PostSaveStateSchema }),

  saved: (page: PageParams = {}): Promise<PostPage> =>
    apiRequest('/api/posts/saved', { query: page, schema: PostPageSchema }),
};

export const notificationsApi = {
  list: (query: NotificationsQuery = {}): Promise<NotificationPage> =>
    apiRequest('/api/notifications', { query: { ...query }, schema: NotificationPageSchema }),

  unreadCount: (): Promise<number> =>
    apiRequest('/api/notifications/unread-count', { schema: UnreadCountSchema }).then(
      (r) => r.count
    ),

  /** Marks the given ids, or every notification when `ids` is omitted, as read. */
  markRead: (ids?: string[]): Promise<number> =>
    apiRequest('/api/notifications/read', {
      method: 'POST',
      body: ids ? { ids } : {},
      schema: UpdatedCountSchema,
    }).then((r) => r.updated),

  presenceSummary: (): Promise<NotificationPresenceSummary> =>
    apiRequest('/api/notifications/presence-summary', {
      schema: NotificationPresenceSummarySchema,
    }),
};

export const chatApi = {
  conversations: (): Promise<ConversationSummary[]> =>
    apiRequest('/api/chat/conversations', { schema: ConversationListSchema }),

  /** Latest 50 messages with `otherUserId`, oldest first. */
  conversation: (otherUserId: string): Promise<ChatMessage[]> =>
    apiRequest(`/api/chat/conversation/${otherUserId}`, { schema: z.array(ChatMessageSchema) }),

  markConversationRead: (otherUserId: string): Promise<number> =>
    apiRequest(`/api/chat/conversation/${otherUserId}/read`, {
      method: 'POST',
      schema: UpdatedCountSchema,
    }).then((r) => r.updated),

  send: (input: SendMessageInput): Promise<ChatMessage> =>
    apiRequest('/api/chat/messages', { method: 'POST', body: input, schema: ChatMessageSchema }),

  react: (messageId: string, reaction: ChatReactionType | null): Promise<ChatMessage> =>
    apiRequest('/api/chat/reaction', {
      method: 'POST',
      body: { messageId, reaction },
      schema: ChatMessageSchema,
    }),

  markListened: (messageId: string): Promise<ChatMessage> =>
    apiRequest('/api/chat/listened', {
      method: 'POST',
      body: { messageId },
      schema: ChatMessageSchema,
    }),
};

export const nowPlayingApi = {
  /** Live presence of followed users (same data as the socket's initial state). */
  friends: (): Promise<FriendPresence[]> =>
    apiRequest('/api/now-playing/friends', { schema: z.array(FriendPresenceSchema) }),

  /** Presence of one user (own profile or a followed user); 404 for anyone else. */
  user: (userId: string): Promise<FriendPresence> =>
    apiRequest(`/api/now-playing/users/${encodeURIComponent(userId)}`, {
      schema: FriendPresenceSchema,
    }),

  /** ADR-013: automatic Spotify / Last.fm sync state of the signed-in user. */
  syncStatus: (): Promise<NowPlayingSyncStatus> =>
    apiRequest('/api/now-playing/sync-status', { schema: NowPlayingSyncStatusSchema }),
};
