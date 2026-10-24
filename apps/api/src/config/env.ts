import { randomBytes } from 'node:crypto';
import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Carica il file .env dalla radice del monorepo se presente
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config(); // Fallback su .env locale se presente

const booleanFromString = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(4000),
    HOST: z.string().default('0.0.0.0'),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
    /**
     * HS256 signing key. Required (min 32 chars) in production. In development/test an ephemeral
     * random key is generated when missing, so sessions do not survive a restart.
     */
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters').optional(),
    JWT_EXPIRES_IN_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(7 * 24 * 60 * 60),
    /** Comma-separated list of allowed browser origins (HTTP CORS and Socket.io). */
    CORS_ORIGIN: z.string().default('http://127.0.0.1:3000,exp://127.0.0.1:8081'),
    /** Defaults to true in production. Set false only for plain-http local setups. */
    COOKIE_SECURE: booleanFromString.optional(),
    /** Optional cookie domain (e.g. `.openmusic.social` when web and api are on subdomains). */
    COOKIE_DOMAIN: z.string().min(1).optional(),
    /**
     * Trust X-Forwarded-* (needed behind a reverse proxy such as Render's, so `request.ip` is the
     * client and not the proxy). With `true` Fastify takes the left-most X-Forwarded-For entry.
     */
    TRUST_PROXY: booleanFromString.default('false'),
    /**
     * Shared secret between the web app's same-origin proxy (`apps/web/src/app/api/[...path]`) and
     * the API. When the proxy presents it, the API rate-limits on the client IP the proxy saw
     * (`X-OpenMusic-Client-IP`) instead of the web server's address. Unset = header ignored.
     */
    PROXY_SECRET: z.string().min(32, 'PROXY_SECRET must be at least 32 characters').optional(),
    /** Pino log level. Defaults to `info` in development, `warn` otherwise. */
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).optional(),
    /**
     * Public URL browsers open the Socket.io connection on (returned by
     * `GET /api/auth/socket-token`). Defaults to Render's `RENDER_EXTERNAL_URL`, then to
     * `http://127.0.0.1:<PORT>` for local development.
     */
    PUBLIC_API_URL: z.string().url().optional(),
    /** Set by Render on every web service (`https://<service>.onrender.com`). */
    RENDER_EXTERNAL_URL: z.string().url().optional(),

    /**
     * First-deploy data (docs/07_DEPLOY.md): on start, import the curated real albums
     * (apps/api/data/curated-albums.json) once, tracked by a database marker.
     */
    SEED_ON_START: booleanFromString.default('false'),
    /**
     * Optional demo community (users, reviews, posts, chats of the dev seed) created once on start
     * when SEED_ON_START=true. Every demo account (including `admin`) gets THIS password, so it
     * must be long and private. Unset = no demo accounts (register your own).
     */
    DEMO_PASSWORD: z.string().min(12, 'DEMO_PASSWORD must be at least 12 characters').optional(),
    /** Max login/register attempts per IP per minute. */
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

    /**
     * Public URL of the web app. OAuth callbacks (Spotify, Last.fm) redirect the browser back
     * here (`/settings?oauth=<provider>&status=success|error`) instead of showing raw JSON.
     */
    WEB_APP_URL: z.string().url().default('http://127.0.0.1:3000'),

    // External catalog (Deezer, iTunes, MusicBrainz, Cover Art Archive)
    /** false = search/open use only the local catalog (no outbound calls). */
    CATALOG_EXTERNAL_ENABLED: booleanFromString.default('true'),
    /** Contact (URL or email) in the MusicBrainz User-Agent, required by their API policy. */
    MUSICBRAINZ_CONTACT: z.string().min(3).default('https://github.com/francoSpagnati/openmusic'),
    /** iTunes storefront for search/lookup (ISO 3166-1 alpha-2). */
    ITUNES_COUNTRY: z
      .string()
      .regex(/^[A-Za-z]{2}$/)
      .default('IT'),

    // ADR-013: background reading of Spotify / Last.fm "now playing".
    /** Defaults to true, except with NODE_ENV=test. CI and Playwright set it to false. */
    NOW_PLAYING_POLLER_ENABLED: booleanFromString.optional(),
    /** Interval while the user or a follower is online, or something played recently. */
    NOW_PLAYING_ACTIVE_INTERVAL_SECONDS: z.coerce.number().int().min(10).max(300).default(25),
    /** Interval for idle users (nobody watching, nothing played recently). */
    NOW_PLAYING_IDLE_INTERVAL_SECONDS: z.coerce.number().int().min(30).max(3600).default(180),
    /** Users not seen in the app for this many days are not polled (accounts set to PAUSED). */
    NOW_PLAYING_INACTIVE_AFTER_DAYS: z.coerce.number().int().min(1).max(365).default(14),
    /** Users polled in parallel by one API instance. */
    NOW_PLAYING_POLL_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(4),

    // Spotify OAuth. Local defaults use 127.0.0.1, never `localhost`: Spotify rejects
    // `localhost` redirect URIs, and web + API must share one host for the session cookie.
    SPOTIFY_CLIENT_ID: z.string().optional().default(''),
    SPOTIFY_CLIENT_SECRET: z.string().optional().default(''),
    // Unset = `<WEB_APP_URL>/api/auth/spotify/callback` (through the web app's same-origin proxy).
    SPOTIFY_REDIRECT_URI: z.string().url().optional(),

    // Last.fm Auth
    LASTFM_API_KEY: z.string().optional().default(''),
    LASTFM_SHARED_SECRET: z.string().optional().default(''),
    // Unset = `<WEB_APP_URL>/api/auth/lastfm/callback` (through the web app's same-origin proxy).
    LASTFM_CALLBACK_URL: z.string().url().optional(),
  })
  .superRefine((e, ctx) => {
    if (e.NODE_ENV === 'production' && !e.JWT_SECRET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET is required in production',
      });
    }
  });

// An empty variable means "not set" (e.g. `JWT_SECRET=""` in .env.example, or an optional secret
// left blank in the Render dashboard): drop it so the default applies instead of failing.
const parsed = EnvSchema.safeParse(
  Object.fromEntries(Object.entries(process.env).filter(([, value]) => value !== ''))
);
if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${details}`);
}

const raw = parsed.data;

if (!raw.JWT_SECRET && raw.NODE_ENV === 'development') {
  console.warn('[env] JWT_SECRET not set: using an ephemeral key (sessions reset on restart).');
}

const webAppUrl = raw.WEB_APP_URL.replace(/\/+$/, '');

export const env = {
  ...raw,
  JWT_SECRET: raw.JWT_SECRET ?? randomBytes(48).toString('base64url'),
  COOKIE_SECURE: raw.COOKIE_SECURE ?? raw.NODE_ENV === 'production',
  NOW_PLAYING_POLLER_ENABLED: raw.NOW_PLAYING_POLLER_ENABLED ?? raw.NODE_ENV !== 'test',
  LOG_LEVEL: raw.LOG_LEVEL ?? (raw.NODE_ENV === 'development' ? 'info' : 'warn'),
  WEB_APP_URL: webAppUrl,
  PUBLIC_API_URL: (
    raw.PUBLIC_API_URL ??
    raw.RENDER_EXTERNAL_URL ??
    `http://127.0.0.1:${raw.PORT}`
  ).replace(/\/+$/, ''),
  // OAuth callbacks reach the API through the web app's /api proxy, so the session and OAuth
  // state cookies are first-party on the web origin (docs/06_API_AND_AUTH.md §1).
  SPOTIFY_REDIRECT_URI: raw.SPOTIFY_REDIRECT_URI ?? `${webAppUrl}/api/auth/spotify/callback`,
  LASTFM_CALLBACK_URL: raw.LASTFM_CALLBACK_URL ?? `${webAppUrl}/api/auth/lastfm/callback`,
  CORS_ORIGINS: raw.CORS_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0),
};

export type Env = typeof env;
