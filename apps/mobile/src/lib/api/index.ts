export { API_URL, resolveApiUrl } from './config';
export {
  apiRequest,
  configureApiClient,
  getAuthToken,
  setAuthToken,
  setUnauthorizedHandler,
  type FetchLike,
  type RequestOptions,
} from './client';
export { ApiError, isApiError, type ClientErrorCode } from './errors';
export { tokenStore } from './tokenStore';
export { authApi } from './auth';
export { usersApi, feedApi, notificationsApi, chatApi, nowPlayingApi } from './social';
export {
  catalogApi,
  reviewsApi,
  profileApi,
  criticApi,
  videosApi,
  discoveryApi,
  playlistsApi,
  spotifyApi,
} from './content';

import { authApi } from './auth';
import { chatApi, feedApi, notificationsApi, nowPlayingApi, usersApi } from './social';
import {
  catalogApi,
  criticApi,
  discoveryApi,
  playlistsApi,
  profileApi,
  reviewsApi,
  spotifyApi,
  videosApi,
} from './content';

/** Every typed endpoint, grouped by domain (same surface as apps/web): `api.feed.list()`, ... */
export const api = {
  auth: authApi,
  users: usersApi,
  feed: feedApi,
  notifications: notificationsApi,
  chat: chatApi,
  nowPlaying: nowPlayingApi,
  catalog: catalogApi,
  reviews: reviewsApi,
  profile: profileApi,
  critic: criticApi,
  videos: videosApi,
  discovery: discoveryApi,
  playlists: playlistsApi,
  spotify: spotifyApi,
} as const;
