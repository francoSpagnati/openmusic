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

// The browser must open the web app on the same host the build calls the API on
// (NEXT_PUBLIC_API_URL), otherwise the session cookie is not sent: derive one from the other.
// Local dev and CI use 127.0.0.1 (Spotify rejects `localhost` redirect URIs).
const API_URL =
  process.env.E2E_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';
const WEB_URL = process.env.E2E_WEB_URL ?? `http://${new URL(API_URL).hostname}:3000`;
// The specs (run in worker processes) read the same URLs.
process.env.E2E_API_URL = API_URL;
process.env.E2E_WEB_URL = WEB_URL;

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
      command: 'npm --workspace=@openmusic/api run start',
      cwd: '../..',
      url: `${API_URL}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        // Many registrations from one IP during a run; keep the auth limiter out of the way.
        AUTH_RATE_LIMIT_MAX: '1000',
        // Seeded data only: no Deezer/iTunes/MusicBrainz calls, so runs are deterministic and
        // work offline (CI sets the same). Export CATALOG_EXTERNAL_ENABLED=true to override.
        CATALOG_EXTERNAL_ENABLED: process.env.CATALOG_EXTERNAL_ENABLED ?? 'false',
      },
    },
    {
      command: 'npx next start -p 3000',
      url: WEB_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
