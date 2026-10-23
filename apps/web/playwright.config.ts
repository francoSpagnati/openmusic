import { existsSync } from 'node:fs';
import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end smoke tests. They drive the real web app against the real API, so they need
 * Postgres + Redis running and a seeded database (`npm run db:seed`).
 *
 * By default Playwright starts both servers itself (API on :4000, `next start` on :3000, so run
 * `npm run build` first). If they are already running they are reused.
 *
 * Browser: set PLAYWRIGHT_CHROMIUM_PATH to use a preinstalled Chromium; the sandbox one at
 * /opt/pw-browsers/chromium is picked up automatically. Otherwise Playwright's own download is
 * used (CI runs `npx playwright install chromium`).
 */
// Same single root .env as the apps (DATABASE_URL for the teardown, ports, API URL).
loadEnvConfig(path.resolve(__dirname, '../..'));

/**
 * Two profiles (ADR-014: the browser only talks to the web origin; `/api/*` is proxied to the
 * API and Socket.io connects to the API with a short-lived token):
 *
 * - default: API on http://127.0.0.1:4000 and web on http://127.0.0.1:3000, like local dev.
 * - E2E_PROFILE=cross-site: production-like, as on Render. Web on http://127.0.0.1:3000 and API on
 *   http://localhost:4000, which are DIFFERENT SITES for the browser (like two *.onrender.com
 *   hosts), both with NODE_ENV=production and started exactly as render.yaml starts them
 *   (`npm run start:api` = migrate + start, `npm run start:web`). Cookies are not `Secure`
 *   (COOKIE_SECURE=false) only because this runs on plain http.
 *   Run: `E2E_PROFILE=cross-site npm run e2e` (after `npm run build` of the web app).
 */
const CROSS_SITE = process.env.E2E_PROFILE === 'cross-site';
const API_URL = (
  process.env.E2E_API_URL ??
  (CROSS_SITE
    ? 'http://localhost:4000'
    : (process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000'))
).replace(/\/+$/, '');
const WEB_URL = process.env.E2E_WEB_URL ?? 'http://127.0.0.1:3000';
// The specs (run in worker processes) read the same URLs.
process.env.E2E_API_URL = API_URL;
process.env.E2E_WEB_URL = WEB_URL;
const API_PORT = new URL(API_URL).port || '4000';
const WEB_PORT = new URL(WEB_URL).port || '3000';
// Shared by the web proxy and the API in the cross-site profile (rate limiting by client IP).
const PROXY_SECRET = 'e2e-proxy-secret-only-for-local-tests-0123456789';

/** Settings both profiles need: deterministic data, no background provider calls. */
const COMMON_API_ENV = {
  PORT: API_PORT,
  // Many registrations from one IP during a run; keep the auth limiter out of the way.
  AUTH_RATE_LIMIT_MAX: '1000',
  // Seeded data only: no Deezer/iTunes/MusicBrainz calls, so runs are deterministic and
  // work offline (CI sets the same). Export CATALOG_EXTERNAL_ENABLED=true to override.
  CATALOG_EXTERNAL_ENABLED: process.env.CATALOG_EXTERNAL_ENABLED ?? 'false',
  // ADR-013: no background Spotify/Last.fm reads during e2e (the settings test inserts
  // sync states directly). Export NOW_PLAYING_POLLER_ENABLED=true to override.
  NOW_PLAYING_POLLER_ENABLED: process.env.NOW_PLAYING_POLLER_ENABLED ?? 'false',
  WEB_APP_URL: WEB_URL,
  CORS_ORIGIN: WEB_URL,
  PUBLIC_API_URL: API_URL,
};

type ServerSpec = { command: string; env: Record<string, string> };

const apiServer: ServerSpec = CROSS_SITE
  ? {
      command: 'npm run start:api',
      env: {
        ...COMMON_API_ENV,
        NODE_ENV: 'production',
        HOST: '0.0.0.0',
        JWT_SECRET: process.env.JWT_SECRET ?? 'e2e-cross-site-jwt-secret-not-for-production-0123',
        COOKIE_SECURE: 'false',
        TRUST_PROXY: 'true',
        PROXY_SECRET,
        LOG_LEVEL: 'warn',
      },
    }
  : { command: 'npm --workspace=@openmusic/api run start', env: COMMON_API_ENV };

const webServer: ServerSpec = CROSS_SITE
  ? {
      command: `npm run start:web -- -H 0.0.0.0 -p ${WEB_PORT}`,
      env: { NODE_ENV: 'production', API_ORIGIN: API_URL, PROXY_SECRET },
    }
  : { command: `npx next start -p ${WEB_PORT}`, env: { API_ORIGIN: API_URL } };

const SANDBOX_CHROMIUM = '/opt/pw-browsers/chromium';
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ??
  (existsSync(SANDBOX_CHROMIUM) ? SANDBOX_CHROMIUM : undefined);

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.results',
  globalTeardown: './e2e/global-teardown.ts',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: WEB_URL,
    locale: 'it-IT',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      ...apiServer,
      cwd: '../..',
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      ...webServer,
      cwd: CROSS_SITE ? '../..' : '.',
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
