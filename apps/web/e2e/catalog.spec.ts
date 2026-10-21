import { expect, test } from '@playwright/test';

/**
 * Catalog flows against the seeded database only. The API that Playwright starts runs with
 * CATALOG_EXTERNAL_ENABLED=false (see playwright.config.ts), so nothing here needs Deezer,
 * iTunes or MusicBrainz to be reachable.
 */

const SEEDED_ALBUM = 'In Rainbows';
const SEEDED_ARTIST = 'Radiohead';
const SEEDED_TRACK = 'Weird Fishes/Arpeggi'; // side B of the seeded tracklist
const OPENING_TRACK = '15 Step';

test('search the catalog from Explore and open a release', async ({ page }) => {
  await page.goto('/explore');
  await page.getByRole('searchbox', { name: 'Cerca nel catalogo' }).fill('rainbows');

  const results = page.getByRole('list', { name: 'Dischi trovati' });
  const album = results.getByRole('link', { name: SEEDED_ALBUM });
  await expect(album).toBeVisible();
  // The query is kept in the URL so the search can be shared.
  await expect(page).toHaveURL(/\/explore\?q=rainbows/);

  await album.click();
  await expect(page).toHaveURL(/\/releases\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1, name: SEEDED_ALBUM })).toBeVisible();
  await expect(page.getByText(SEEDED_ARTIST).first()).toBeVisible();

  // Real tracklist with durations (m:ss) and a preview button per track.
  const tracklist = page.getByRole('region', { name: 'Tracklist' });
  await expect(tracklist.getByText(OPENING_TRACK).first()).toBeVisible();
  await expect(tracklist.getByText(/^\d{1,2}:\d{2}$/).first()).toBeVisible();
  await expect(
    tracklist.getByRole('button', { name: `Ascolta l’anteprima di ${OPENING_TRACK}` })
  ).toBeVisible();
});

test('a track result deep-links to its row in the tracklist', async ({ page }) => {
  await page.goto(`/explore?q=${encodeURIComponent('weird fishes')}`);
  const track = page.getByRole('link', { name: SEEDED_TRACK });
  await expect(track).toBeVisible();
  await track.click();
  await expect(page).toHaveURL(/\/releases\/[0-9a-f-]{36}#track-[0-9a-f-]{36}$/);
  await expect(page.locator('li[aria-current="true"]')).toContainText(SEEDED_TRACK);
});

test('global search box suggests releases and opens the full search', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/videos');
  const box = page.getByRole('searchbox', { name: 'Cerca dischi e brani' });
  await box.fill('rainbows');
  await expect(
    page
      .getByRole('search', { name: 'Catalogo' })
      .getByRole('link', { name: new RegExp(SEEDED_ALBUM) })
  ).toBeVisible();

  await box.press('Enter');
  await expect(page).toHaveURL(/\/explore\?q=rainbows/);
  await expect(
    page.getByRole('list', { name: 'Dischi trovati' }).getByRole('link', { name: SEEDED_ALBUM })
  ).toBeVisible();
});

test('legacy deezer ids go through the resolver instead of erroring', async ({ page }) => {
  // A real HTTP redirect to the resolver route...
  const redirect = await page.request.get('/releases/deezer-alb-999999999', { maxRedirects: 0 });
  expect(redirect.status()).toBe(308);
  expect(redirect.headers()['location']).toMatch(/\/releases\/external\/deezer\/999999999$/);

  // ...which, with external catalogs disabled, cannot import it: the resolver answers 404.
  const response = await page.goto('/releases/deezer-alb-999999999');
  expect(response?.status()).toBe(404);
  await expect(page).toHaveURL(/\/releases\/external\/deezer\/999999999$/);
  await expect(page.getByText('Questo disco non è sui nostri scaffali')).toBeVisible();
});

test('the OAuth callback outcome is shown once and removed from the URL', async ({ page }) => {
  await page.goto('/auth?oauth=spotify&status=error&code=UPSTREAM_ERROR');
  await expect(page.getByText('Collegamento a Spotify non riuscito')).toBeVisible();
  await expect(
    page.getByText('Spotify non risponde in questo momento.', { exact: false })
  ).toBeVisible();
  await expect(page).toHaveURL(/\/auth$/);
});
