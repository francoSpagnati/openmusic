import { proxyToApi } from '@/lib/api/proxy';

/**
 * `/api/*` -> the OpenMusic API (ADR-014). The browser never calls the API's own origin for
 * HTTP, so session and OAuth cookies stay first-party on the web origin. Socket.io is not
 * proxied: it connects to the API directly with a token from `/api/auth/socket-token`.
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function handler(request: Request): Promise<Response> {
  return proxyToApi(request);
}

export const GET = handler;
export const HEAD = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
