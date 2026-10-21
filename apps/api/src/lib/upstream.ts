/** Upper bound for any call to a third-party API (Deezer, iTunes, Spotify, Last.fm). */
export const UPSTREAM_TIMEOUT_MS = 5_000;

/**
 * Abort signal for an upstream `fetch`: without it a slow provider holds the request (and a
 * socket) open indefinitely, and public endpoints like catalog search become an easy DoS lever.
 */
export function upstreamSignal(): AbortSignal {
  return AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
}

/** `fetch` with the upstream timeout applied (unless the caller passes its own signal). */
export function upstreamFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  return fetch(input, { ...init, signal: init.signal ?? upstreamSignal() });
}
