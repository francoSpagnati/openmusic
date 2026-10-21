import { z } from 'zod';
import {
  AudioPreviewResultSchema,
  CatalogReleaseSchema,
  CatalogResolveResultSchema,
  CriticAccreditationStatusSchema,
  CriticReviewItemSchema,
  DiscoveryFeedResponseSchema,
  DualScoreDetailsSchema,
  GenreListSchema,
  GenreRouletteResultSchema,
  MusicVideoItemSchema,
  PendingCriticRequestSchema,
  PlaylistDetailsSchema,
  PlaylistSummarySchema,
  ReactionTypeSchema,
  ReleasePageSchema,
  ReviewItemSchema,
  SearchResultSchema,
  SpotifySyncPlaybackResponseSchema,
  UserProfileDataSchema,
  type AddTrackToPlaylistInput,
  type AudioPreviewResolveQuery,
  type AudioPreviewResult,
  type BrowseReleasesQuery,
  type CatalogRelease,
  type CatalogResolveQuery,
  type CatalogResolveResult,
  type CatalogSearchQuery,
  type CreatePlaylistInput,
  type CreateReviewInput,
  type CreateVideoContentInput,
  type CriticAccreditationRequest,
  type CriticAccreditationStatus,
  type CriticReviewItem,
  type DiscoveryFeedResponse,
  type DualScoreDetails,
  type GenreList,
  type GenreRouletteResult,
  type MusicVideoItem,
  type PendingCriticRequest,
  type PlaylistDetails,
  type PlaylistSummary,
  type PublishCriticReviewInput,
  type ReactionType,
  type ReleasePage,
  type ReviewItem,
  type SearchResult,
  type SpotifySyncPlaybackResponse,
  type ToggleReactionInput,
  type UserProfileData,
  type VideoCategory,
} from '@openmusic/shared';
import { apiRequest } from './client';

export const catalogApi = {
  /**
   * Local catalog first, then Deezer/iTunes results imported on the fly: every id is an internal
   * UUID. Pass an object for paging/filters (`{ q, type, page, limit, external }`).
   */
  search: (query: string | CatalogSearchQuery): Promise<SearchResult> =>
    apiRequest('/api/catalog/search', {
      query: typeof query === 'string' ? { q: query } : { ...query },
      schema: SearchResultSchema,
    }),

  /** External id (Deezer / iTunes / MusicBrainz) -> internal release, imported on first use. */
  resolve: (query: CatalogResolveQuery): Promise<CatalogResolveResult> =>
    apiRequest('/api/catalog/resolve', { query: { ...query }, schema: CatalogResolveResultSchema }),

  browse: (query: BrowseReleasesQuery = {}): Promise<ReleasePage> =>
    apiRequest('/api/catalog/releases', { query: { ...query }, schema: ReleasePageSchema }),

  genres: (): Promise<GenreList> => apiRequest('/api/catalog/genres', { schema: GenreListSchema }),

  release: (id: string): Promise<CatalogRelease> =>
    apiRequest(`/api/catalog/releases/${id}`, { schema: CatalogReleaseSchema }),

  preview: (query: AudioPreviewResolveQuery): Promise<AudioPreviewResult> =>
    apiRequest('/api/catalog/preview', { query: { ...query }, schema: AudioPreviewResultSchema }),
};

export const reviewsApi = {
  forRelease: (releaseId: string): Promise<ReviewItem[]> =>
    apiRequest(`/api/reviews/release/${releaseId}`, { schema: z.array(ReviewItemSchema) }),

  /** Creates or updates the caller's review of a release. */
  upsert: (input: CreateReviewInput): Promise<ReviewItem> =>
    apiRequest('/api/reviews', { method: 'POST', body: input, schema: ReviewItemSchema }),

  toggleReaction: (input: ToggleReactionInput): Promise<{ added: boolean; type: ReactionType }> =>
    apiRequest('/api/reviews/reaction', {
      method: 'POST',
      body: input,
      schema: z.object({ added: z.boolean(), type: ReactionTypeSchema }),
    }),
};

export const profileApi = {
  me: (): Promise<UserProfileData> =>
    apiRequest('/api/profile/me', { schema: UserProfileDataSchema }),
  byId: (userId: string): Promise<UserProfileData> =>
    apiRequest(`/api/profile/${userId}`, { schema: UserProfileDataSchema }),
  byUsername: (username: string): Promise<UserProfileData> =>
    apiRequest(`/api/profile/by-username/${encodeURIComponent(username)}`, {
      schema: UserProfileDataSchema,
    }),
};

export const criticApi = {
  requestAccreditation: (input: CriticAccreditationRequest): Promise<CriticAccreditationStatus> =>
    apiRequest('/api/critic/accredit', {
      method: 'POST',
      body: input,
      schema: CriticAccreditationStatusSchema,
    }),
  accreditationStatus: (): Promise<CriticAccreditationStatus> =>
    apiRequest('/api/critic/accreditation', { schema: CriticAccreditationStatusSchema }),
  /** ADMIN only. */
  pendingRequests: (): Promise<PendingCriticRequest[]> =>
    apiRequest('/api/critic/requests', { schema: z.array(PendingCriticRequestSchema) }),
  /** ADMIN only. */
  verify: (userId: string, approve: boolean): Promise<CriticAccreditationStatus> =>
    apiRequest('/api/critic/verify', {
      method: 'POST',
      body: { userId, approve },
      schema: CriticAccreditationStatusSchema,
    }),
  /** CRITIC only. */
  publishReview: (input: PublishCriticReviewInput): Promise<CriticReviewItem> =>
    apiRequest('/api/critic/reviews', {
      method: 'POST',
      body: input,
      schema: CriticReviewItemSchema,
    }),
  dualScore: (releaseId: string): Promise<DualScoreDetails> =>
    apiRequest(`/api/critic/dual-score/${releaseId}`, { schema: DualScoreDetailsSchema }),
  reviewsForRelease: (releaseId: string): Promise<CriticReviewItem[]> =>
    apiRequest(`/api/critic/release/${releaseId}`, { schema: z.array(CriticReviewItemSchema) }),
};

export const videosApi = {
  feed: (category?: VideoCategory): Promise<MusicVideoItem[]> =>
    apiRequest('/api/videos/feed', { query: { category }, schema: z.array(MusicVideoItemSchema) }),
  forRelease: (releaseId: string): Promise<MusicVideoItem[]> =>
    apiRequest(`/api/videos/release/${releaseId}`, { schema: z.array(MusicVideoItemSchema) }),
  /** CRITIC / MODERATOR / ADMIN only. */
  publish: (input: CreateVideoContentInput): Promise<MusicVideoItem> =>
    apiRequest('/api/videos', { method: 'POST', body: input, schema: MusicVideoItemSchema }),
};

export const discoveryApi = {
  reels: (): Promise<DiscoveryFeedResponse> =>
    apiRequest('/api/discovery/reels', { schema: DiscoveryFeedResponseSchema }),
  roulette: (): Promise<GenreRouletteResult> =>
    apiRequest('/api/discovery/roulette', { schema: GenreRouletteResultSchema }),
};

export const playlistsApi = {
  create: (input: CreatePlaylistInput): Promise<PlaylistDetails> =>
    apiRequest('/api/playlists', { method: 'POST', body: input, schema: PlaylistDetailsSchema }),
  addTrack: (input: AddTrackToPlaylistInput): Promise<PlaylistDetails> =>
    apiRequest('/api/playlists/track', {
      method: 'POST',
      body: input,
      schema: PlaylistDetailsSchema,
    }),
  get: (id: string): Promise<PlaylistDetails> =>
    apiRequest(`/api/playlists/${id}`, { schema: PlaylistDetailsSchema }),
  byUser: (userId: string): Promise<PlaylistSummary[]> =>
    apiRequest(`/api/playlists/user/${userId}`, { schema: z.array(PlaylistSummarySchema) }),
};

export const spotifyApi = {
  /** Requires a linked Spotify account (409 CONFLICT otherwise). */
  syncPlayback: (): Promise<SpotifySyncPlaybackResponse> =>
    apiRequest('/api/spotify/sync-playback', {
      method: 'POST',
      schema: SpotifySyncPlaybackResponseSchema,
    }),
};
