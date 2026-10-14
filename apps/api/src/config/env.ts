import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

// Carica il file .env dalla radice del monorepo se presente
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config(); // Fallback su .env locale se presente

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(16).default('openmusic_super_secret_jwt_key_at_least_32_characters'),
  CORS_ORIGIN: z.string().default('http://localhost:3000,exp://localhost:8081'),

  // Spotify OAuth
  SPOTIFY_CLIENT_ID: z.string().optional().default(''),
  SPOTIFY_CLIENT_SECRET: z.string().optional().default(''),
  SPOTIFY_REDIRECT_URI: z.string().default('http://localhost:4000/api/auth/spotify/callback'),

  // Last.fm Auth
  LASTFM_API_KEY: z.string().optional().default(''),
  LASTFM_SHARED_SECRET: z.string().optional().default(''),
  LASTFM_CALLBACK_URL: z.string().default('http://localhost:4000/api/auth/lastfm/callback'),
});

export const env = EnvSchema.parse(process.env);
