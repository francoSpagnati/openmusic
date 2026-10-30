/**
 * Base URL of the OpenMusic API (no trailing slash), from `EXPO_PUBLIC_API_URL` (inlined by Metro
 * at build time). On a physical device or the Android emulator `127.0.0.1` is the device itself:
 * use your machine's LAN IP (e.g. `http://192.168.1.20:4000`) or `http://10.0.2.2:4000`.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:4000').replace(
  /\/+$/,
  ''
);

/** Requests that take longer than this are aborted and reported as NETWORK_ERROR. */
export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Playable URL for an audio/image link returned by the API. The API serves Deezer previews as a
 * root-relative path (`/api/catalog/tracks/<id>/preview`, a redirect to a fresh signed URL):
 * native players need an absolute URL, so it is resolved against `API_URL`. Absolute URLs pass.
 */
export function resolveApiUrl(url: string): string {
  return url.startsWith('/') && !url.startsWith('//') ? `${API_URL}${url}` : url;
}
