import { expect, test, type Page } from '@playwright/test';

/**
 * Light/dark theme (ADR-015): the stored choice is applied by the inline bootstrap script before
 * the first paint (no flash, no hydration warning), the toggle persists it, flipping back to the
 * OS value clears it, and blocked storage never breaks the page.
 */

const HYDRATION = /hydrat|did not match|server rendered HTML/i;

/** Records `data-theme` as it is when the HTML has been parsed, before React hydrates. */
async function recordFirstPaintTheme(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      (window as unknown as { __firstTheme: string | null }).__firstTheme =
        document.documentElement.getAttribute('data-theme');
    });
  });
}

const firstTheme = (page: Page) =>
  page.evaluate(() => (window as unknown as { __firstTheme: string | null }).__firstTheme);

function collectHydrationErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && HYDRATION.test(message.text())) errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test.use({ colorScheme: 'light' });

test('a stored dark choice is painted before hydration, without warnings', async ({ page }) => {
  const errors = collectHydrationErrors(page);
  await page.addInitScript(() => window.localStorage.setItem('om-theme', 'dark'));
  await recordFirstPaintTheme(page);

  await page.goto('/auth');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  expect(await firstTheme(page)).toBe('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  // Form controls and scrollbars follow the choice through CSS; React's meta is not duplicated.
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe(
    'dark'
  );
  await expect(page.locator('meta[name="color-scheme"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('the toggle persists the choice and going back to the OS value clears it', async ({
  page,
}) => {
  await page.goto('/auth');
  const html = page.locator('html');
  await expect(html).not.toHaveAttribute('data-theme', /.+/);

  await page.getByRole('button', { name: 'Passa al tema scuro' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  expect(await page.evaluate(() => window.localStorage.getItem('om-theme'))).toBe('dark');

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');

  // The OS is light: choosing light again means "follow the system".
  await page.getByRole('button', { name: 'Passa al tema chiaro' }).click();
  await expect(html).not.toHaveAttribute('data-theme', /.+/);
  expect(await page.evaluate(() => window.localStorage.getItem('om-theme'))).toBeNull();
});

test('blocked storage: the page renders and the toggle still works for this view', async ({
  page,
}) => {
  const errors = collectHydrationErrors(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
  });

  await page.goto('/auth');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'Passa al tema scuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(errors).toEqual([]);
});
