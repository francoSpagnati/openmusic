/**
 * Base URL of the OpenMusic API (no trailing slash). Set NEXT_PUBLIC_API_URL in the root .env;
 * defaults to the local Fastify server.
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000').replace(
  /\/+$/,
  ''
);
