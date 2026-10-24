export { apiUrl, serverApiOrigin } from './config';
export { apiRequest, type RequestOptions } from './client';
export { ApiError, isApiError, type ClientErrorCode } from './errors';
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

/** Every typed endpoint, grouped by domain: `api.feed.list()`, `api.users.follow(id)`, ... */
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
