import { expect, test } from '@playwright/test';
import { newTestAccount } from './account';

/**
 * ADR-013: the settings page shows the automatic Spotify / Last.fm sync state. Real OAuth is not
 * possible here, so the linked accounts and their sync state are written straight into the
 * database (the API Playwright starts runs with NOW_PLAYING_POLLER_ENABLED=false, so nothing
 * overwrites them). The account is removed by the global teardown with the others.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://127.0.0.1:4000';

test('settings show the sync state, the relink action and the manual sync', async ({ page }) => {
  const account = newTestAccount();
  const register = await page.request.post(`${API_URL}/api/auth/register`, {
    data: { email: account.email, username: account.username, password: account.password },
  });
  expect(register.status()).toBe(201);
  const { user } = (await register.json()) as { user: { id: string } };

  // Same generated client as the teardown (the @openmusic/db entry is TypeScript source).
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();
  try {
    await prisma.connectedAccount.createMany({
      data: [
        {
          userId: user.id,
          provider: 'SPOTIFY',
          providerId: `e2e-spotify-${account.runId}`,
          accessToken: 'revoked',
          refreshToken: 'revoked',
          syncStatus: 'ERROR',
          syncError: 'TOKEN_REVOKED',
          lastSyncedAt: new Date(Date.now() - 3 * 60 * 60_000),
        },
        {
          userId: user.id,
          provider: 'LASTFM',
          providerId: `e2e-lastfm-${account.runId}`,
          accessToken: 'session',
          syncStatus: 'ACTIVE',
          lastSyncedAt: new Date(Date.now() - 5 * 60_000),
        },
      ],
    });
  } finally {
    await prisma.$disconnect();
  }

  const status = await page.request.get(`${API_URL}/api/now-playing/sync-status`);
  expect(status.ok()).toBe(true);
  expect(await status.json()).toMatchObject({
    autoSyncEnabled: false,
    providers: {
      SPOTIFY: { linked: true, status: 'ERROR', lastErrorCode: 'TOKEN_REVOKED' },
      LASTFM: { linked: true, status: 'ACTIVE', lastErrorCode: null },
    },
  });

  await page.goto('/settings#connessioni');
  const section = page.locator('#connessioni');
  await expect(section.getByText('Sincronizzazione interrotta')).toBeVisible();
  await expect(section.getByText(/autorizzazione è scaduta o è stata revocata/)).toBeVisible();
  await expect(section.getByRole('button', { name: 'Ricollega' })).toBeVisible();
  // Manual sync stays available as a fallback.
  await expect(section.getByRole('button', { name: 'Sincronizza ora' })).toBeVisible();
  // Last update as relative, tabular time.
  const lastUpdate = section.locator('time.tabular-nums').first();
  await expect(lastUpdate).toHaveText(/fa$/);
  // This API runs without the poller: Last.fm says so instead of claiming an active sync.
  await expect(section.getByText(/non è attiva su questo server/)).toBeVisible();
});
