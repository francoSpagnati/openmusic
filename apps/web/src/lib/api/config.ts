/**
 * Base URL of the OpenMusic API (no trailing slash). Set NEXT_PUBLIC_API_URL in the root .env;
 * defaults to the local Fastify server on 127.0.0.1, the same host the web app is opened on
 * (http://127.0.0.1:3000), so the session cookie is sent with API calls.
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000').replace(
  /\/+$/,
  ''
);
