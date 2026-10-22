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
    /** Trust X-Forwarded-* (needed behind a reverse proxy so rate limiting sees client IPs). */
    TRUST_PROXY: booleanFromString.default('false'),
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

    // Spotify OAuth. Local defaults use 127.0.0.1, never `localhost`: Spotify rejects
    // `localhost` redirect URIs, and web + API must share one host for the session cookie.
    SPOTIFY_CLIENT_ID: z.string().optional().default(''),
    SPOTIFY_CLIENT_SECRET: z.string().optional().default(''),
    SPOTIFY_REDIRECT_URI: z.string().default('http://127.0.0.1:4000/api/auth/spotify/callback'),

    // Last.fm Auth
    LASTFM_API_KEY: z.string().optional().default(''),
    LASTFM_SHARED_SECRET: z.string().optional().default(''),
    LASTFM_CALLBACK_URL: z.string().default('http://127.0.0.1:4000/api/auth/lastfm/callback'),
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

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${details}`);
}

const raw = parsed.data;

if (!raw.JWT_SECRET && raw.NODE_ENV === 'development') {
  console.warn('[env] JWT_SECRET not set: using an ephemeral key (sessions reset on restart).');
}

export const env = {
  ...raw,
  JWT_SECRET: raw.JWT_SECRET ?? randomBytes(48).toString('base64url'),
  COOKIE_SECURE: raw.COOKIE_SECURE ?? raw.NODE_ENV === 'production',
  WEB_APP_URL: raw.WEB_APP_URL.replace(/\/+$/, ''),
  CORS_ORIGINS: raw.CORS_ORIGIN.split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0),
};

export type Env = typeof env;
