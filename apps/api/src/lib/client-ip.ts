import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { FastifyRequest } from 'fastify';

/**
 * Headers set by the web app's same-origin proxy (`apps/web/src/app/api/[...path]/route.ts`,
 * ADR-014). The proxy always overwrites them, so a browser cannot smuggle its own values through.
 */
export const PROXY_SECRET_HEADER = 'x-openmusic-proxy-secret';
export const PROXY_CLIENT_IP_HEADER = 'x-openmusic-client-ip';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Client IP used for rate limiting.
 *
 * Requests relayed by the web app's proxy arrive from the web server, not from the browser: all
 * users would share one rate-limit bucket. When the proxy proves itself with `PROXY_SECRET`, the
 * client IP it saw is used instead. Everything else (direct calls, mobile app, a wrong or missing
 * secret) falls back to `request.ip`, which honours `TRUST_PROXY` (Render's X-Forwarded-For).
 */
export function clientIpResolver(proxySecret: string | undefined) {
  return function clientIp(request: FastifyRequest): string {
    if (proxySecret) {
      const secret = request.headers[PROXY_SECRET_HEADER];
      const forwarded = request.headers[PROXY_CLIENT_IP_HEADER];
      if (
        typeof secret === 'string' &&
        typeof forwarded === 'string' &&
        isIP(forwarded.trim()) !== 0 &&
        safeEqual(secret, proxySecret)
      ) {
        return forwarded.trim();
      }
    }
    return request.ip;
  };
}
