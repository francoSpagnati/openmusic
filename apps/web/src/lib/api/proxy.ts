import type { ApiErrorBody } from '@openmusic/shared';
import { serverApiOrigin } from './config';

/**
 * Same-origin proxy from the web app to the API (ADR-014). Server-only: used by
 * `src/app/api/[...path]/route.ts`.
 *
 * The browser only ever talks to the web origin, so the API's `Set-Cookie` (session, OAuth state)
 * lands on the web origin and comes back on every `/api/*` request: first-party cookies, whatever
 * site the API lives on. Redirects (OAuth callbacks) are passed through, not followed.
 */

/** Must match apps/api/src/lib/client-ip.ts. */
const PROXY_SECRET_HEADER = 'x-openmusic-proxy-secret';
const PROXY_CLIENT_IP_HEADER = 'x-openmusic-client-ip';

/** A sleeping free-tier API can take about a minute to wake up: wait for it. */
export const UPSTREAM_TIMEOUT_MS = 90_000;

/** Request headers never forwarded (hop-by-hop, recomputed, or reserved for the proxy). */
const DROP_REQUEST_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
  // fetch decompresses transparently; ask for identity so headers and body agree.
  'accept-encoding',
  PROXY_SECRET_HEADER,
  PROXY_CLIENT_IP_HEADER,
]);

/** Response headers never copied back (hop-by-hop, or invalid once fetch decoded the body). */
const DROP_RESPONSE_HEADERS = new Set([
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-encoding',
  'content-length',
  'set-cookie', // copied one by one below
]);

const NO_BODY_STATUSES = new Set([101, 204, 205, 304]);

export interface ProxyConfig {
  /** API origin, e.g. https://openmusic-api.onrender.com (server-only `API_ORIGIN`). */
  origin: string;
  /** `PROXY_SECRET` shared with the API: lets it rate-limit on the browser's IP. */
  secret?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export function defaultProxyConfig(): ProxyConfig {
  return { origin: serverApiOrigin(), secret: process.env.PROXY_SECRET || undefined };
}

/** First X-Forwarded-For entry: the browser, as reported by the platform's edge proxy. */
export function clientIpFrom(headers: Headers): string | null {
  const first = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return first ? first : null;
}

function errorResponse(status: number, body: ApiErrorBody): Response {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

export async function proxyToApi(
  request: Request,
  config: ProxyConfig = defaultProxyConfig()
): Promise<Response> {
  const incoming = new URL(request.url);
  const target = new URL(`${incoming.pathname}${incoming.search}`, config.origin);
  // `/api/%2e%2e/x` would normalize outside /api: only API routes are proxied.
  if (!target.pathname.startsWith('/api/')) {
    return errorResponse(404, { statusCode: 404, code: 'NOT_FOUND', message: 'Not found' });
  }

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (!DROP_REQUEST_HEADERS.has(key)) headers.set(key, value);
  });
  const clientIp = clientIpFrom(request.headers);
  if (config.secret && clientIp) {
    headers.set(PROXY_SECRET_HEADER, config.secret);
    headers.set(PROXY_CLIENT_IP_HEADER, clientIp);
  }

  const method = request.method.toUpperCase();
  const hasBody = method !== 'GET' && method !== 'HEAD';
  let upstream: Response;
  try {
    upstream = await (config.fetchImpl ?? fetch)(target, {
      method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.any([
        request.signal,
        AbortSignal.timeout(config.timeoutMs ?? UPSTREAM_TIMEOUT_MS),
      ]),
    });
  } catch (err) {
    if (request.signal.aborted) throw err;
    console.error(`[api-proxy] ${method} ${incoming.pathname} -> ${config.origin} failed`, err);
    return errorResponse(502, {
      statusCode: 502,
      code: 'UPSTREAM_ERROR',
      message: 'Il server OpenMusic non risponde: riprova tra qualche secondo',
    });
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!DROP_RESPONSE_HEADERS.has(key)) responseHeaders.set(key, value);
  });
  for (const cookie of upstream.headers.getSetCookie())
    responseHeaders.append('set-cookie', cookie);

  const body = method === 'HEAD' || NO_BODY_STATUSES.has(upstream.status) ? null : upstream.body;
  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
