/**
 * Where API requests go (ADR-014, docs/06_API_AND_AUTH.md §1).
 *
 * - In the browser: the web app's own origin. `/api/*` is a same-origin proxy
 *   (`src/app/api/[...path]/route.ts`) to the API, so the session and OAuth cookies are
 *   first-party cookies of the web origin, even when web and API live on different sites
 *   (e.g. two `*.onrender.com` hosts, which are different sites: onrender.com is on the Public
 *   Suffix List).
 * - On the server (Server Components, the proxy itself): `API_ORIGIN`, a server-only variable,
 *   falling back to NEXT_PUBLIC_API_URL (older .env files) and the local API.
 */
export function serverApiOrigin(): string {
  return (
    process.env.API_ORIGIN ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://127.0.0.1:4000'
  ).replace(/\/+$/, '');
}

/** Absolute URL of an API path (`/api/...`) for the current environment. */
export function apiUrl(path: string): URL {
  const base = typeof window === 'undefined' ? serverApiOrigin() : window.location.origin;
  return new URL(path, base);
}
