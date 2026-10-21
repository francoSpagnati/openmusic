import path from 'node:path';
import { expect, test } from '@playwright/test';
import { newTestAccount } from './account';

/**
 * Golden path smoke test against the real API and the seeded database:
 * register -> log in -> home feed -> release page -> review -> chat message.
 *
 * Each run registers a fresh account, so it can run repeatedly against the same database.
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:4000';
const SEEDED_PEER = 'francospagnati';

const account = newTestAccount();
const { runId } = account;

/** Session cookie saved by the login test and reused afterwards (the API rate-limits logins). */
const SESSION_STATE = path.join(__dirname, '.results', `session-${runId}.json`);

test.describe.configure({ mode: 'serial' });

test('register a new local account', async ({ page }) => {
  await page.goto('/auth?mode=register');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Username').fill(account.username);
  await page.locator('#new-password').fill(account.password);
  await page.getByRole('button', { name: 'Crea account' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Il tuo feed' })).toBeAttached();
});

test('log in with email and password', async ({ page }) => {
  await page.goto('/auth?mode=login');
  await page.getByLabel('Email').fill(account.email);
  await page.locator('#current-password').fill(account.password);
  await page.getByRole('button', { name: 'Accedi', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  const me = await page.request.get(`${API_URL}/api/auth/me`);
  expect(me.ok()).toBe(true);
  expect(await me.json()).toMatchObject({ user: { username: account.username } });
  await page.context().storageState({ path: SESSION_STATE });
});

test.describe('signed in', () => {
  test.use({ storageState: SESSION_STATE });

  test('home feed renders real posts', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Tutti' }).click();
    await expect(page.locator('article').first()).toBeVisible();
  });

  test('open a release from Explore and post a review', async ({ page }) => {
    await page.goto('/explore');
    const firstRelease = page.locator('a[href^="/releases/"]').first();
    await expect(firstRelease).toBeVisible();
    await firstRelease.click();
    await expect(page).toHaveURL(/\/releases\/[0-9a-f-]{36}/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const composer = page.getByRole('form', { name: /Com’è questo disco\?/ });
    await expect(composer).toBeVisible();
    const slider = composer.getByRole('slider');
    await slider.focus();
    for (let i = 0; i < 4; i++) await slider.press('PageUp');
    await expect(slider).toHaveAttribute('aria-valuenow', '4');

    const text = `Smoke test ${runId}: ottimo disco.`;
    await composer.getByLabel('Cosa ne pensi?').fill(text);
    await composer.getByRole('button', { name: 'Pubblica' }).click();

    await expect(page.getByRole('button', { name: 'Modifica la tua recensione' })).toBeVisible();
    await expect(page.getByText(text).first()).toBeVisible();
  });

  test('send a chat message to a seeded user', async ({ page }) => {
    const search = await page.request.get(`${API_URL}/api/users/search?q=${SEEDED_PEER}`);
    const { items } = (await search.json()) as { items: { id: string; username: string }[] };
    const peer = items.find((u) => u.username === SEEDED_PEER);
    expect(peer, `seeded user ${SEEDED_PEER} missing: run npm run db:seed`).toBeDefined();

    await page.goto(`/chat?with=${peer!.id}`);
    const input = page.getByPlaceholder('Scrivi un consiglio musicale…');
    await expect(input).toBeVisible();
    const message = `Ciao dal test e2e ${runId}`;
    await input.fill(message);
    await page.getByRole('button', { name: 'Invia messaggio' }).click();

    await expect(page.getByRole('log').getByText(message)).toBeVisible();
    // Persisted server side, not just optimistic.
    await expect
      .poll(async () => {
        const res = await page.request.get(`${API_URL}/api/chat/conversation/${peer!.id}`);
        return res.ok() ? JSON.stringify(await res.json()) : '';
      })
      .toContain(message);
  });
});
