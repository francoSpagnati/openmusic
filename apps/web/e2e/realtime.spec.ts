import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { newTestAccount } from './account';

/**
 * ADR-014: the browser talks only to the web origin (`/api/*` is proxied to the API), and
 * Socket.io connects to the API directly with a token from `/api/auth/socket-token`. Two users in
 * two browsers: live presence and a chat message must arrive over the socket, without reloads.
 *
 * Runs in both e2e profiles; in the cross-site one (playwright.config.ts, E2E_PROFILE=cross-site)
 * web and API are on different sites, as on Render (*.onrender.com is a public suffix).
 */

const WEB_URL = process.env.E2E_WEB_URL ?? 'http://127.0.0.1:3000';
const API_URL = process.env.E2E_API_URL ?? 'http://127.0.0.1:4000';

interface Signed {
  context: BrowserContext;
  page: Page;
  id: string;
  username: string;
}

async function signUp(browser: Browser): Promise<Signed> {
  const account = newTestAccount();
  const context = await browser.newContext({ baseURL: WEB_URL, locale: 'it-IT' });
  const page = await context.newPage();
  const res = await page.request.post('/api/auth/register', {
    data: { email: account.email, username: account.username, password: account.password },
  });
  expect(res.status()).toBe(201);
  const { user } = (await res.json()) as { user: { id: string } };
  return { context, page, id: user.id, username: account.username };
}

test('session cookie is first-party on the web origin, never on the API site', async ({
  browser,
}) => {
  const alice = await signUp(browser);
  try {
    const cookies = await alice.context.cookies();
    const session = cookies.find((c) => c.name === 'om_session');
    expect(session, 'session cookie set through the /api proxy').toBeDefined();
    expect(session?.domain).toBe(new URL(WEB_URL).hostname);
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe('Lax');
    if (new URL(API_URL).hostname !== new URL(WEB_URL).hostname) {
      expect(await alice.context.cookies(API_URL)).toEqual([]);
    }

    // The proxied API answers as the signed-in user; a socket token points at the API.
    const me = await alice.page.request.get('/api/auth/me');
    expect(me.ok()).toBe(true);
    const token = await alice.page.request.get('/api/auth/socket-token');
    expect(token.ok()).toBe(true);
    expect(((await token.json()) as { url: string }).url).toBe(API_URL);
  } finally {
    await alice.context.close();
  }
});

test('OAuth callbacks are passed through the proxy as redirects to the web app', async ({
  page,
}) => {
  // No state cookie: the API refuses (FORBIDDEN) and sends the browser back to the web app.
  const res = await page.request.get('/api/auth/spotify/callback?code=x&state=forged', {
    maxRedirects: 0,
  });
  expect(res.status()).toBe(302);
  expect(res.headers()['location']).toBe(
    `${WEB_URL}/auth?oauth=spotify&status=error&code=FORBIDDEN`
  );
});

test('the OAuth state cookie round-trips through the proxy (web-origin callback)', async ({
  page,
}) => {
  const login = await page.request.get('/api/auth/spotify/login');
  expect(login.ok()).toBe(true);
  const consent = new URL(((await login.json()) as { url: string }).url);
  const state = consent.searchParams.get('state');
  expect(state).toBeTruthy();
  // The redirect URI registered on Spotify must end on the web app's /api proxy in production.
  expect(consent.searchParams.get('redirect_uri')).toMatch(/\/api\/auth\/spotify\/callback$/);
  const stateCookie = (await page.context().cookies()).find((c) => c.name === 'om_oauth_state');
  expect(stateCookie?.domain).toBe(new URL(WEB_URL).hostname);

  // The user denies consent: the state matches (cookie sent back through the proxy), so the
  // outcome is BAD_REQUEST and not FORBIDDEN (which a missing state cookie would give).
  const callback = await page.request.get(
    `/api/auth/spotify/callback?error=access_denied&state=${encodeURIComponent(state!)}`,
    { maxRedirects: 0 }
  );
  expect(callback.status()).toBe(302);
  expect(callback.headers()['location']).toBe(
    `${WEB_URL}/auth?oauth=spotify&status=error&code=BAD_REQUEST`
  );
});

/**
 * Resolves with the URL of the page's Socket.io connection once the API accepted the handshake
 * (the server sends the initial friends state only to authenticated sockets).
 */
function socketAccepted(page: Page): Promise<string> {
  return new Promise((resolve) => {
    page.on('websocket', (ws) => {
      if (!ws.url().includes('/socket.io/')) return;
      ws.on('framereceived', ({ payload }) => {
        if (typeof payload === 'string' && payload.includes('now_playing:initial_friends_state')) {
          resolve(ws.url());
        }
      });
    });
  });
}

test('live presence and chat arrive over the socket across two browsers', async ({ browser }) => {
  const alice = await signUp(browser);
  const bob = await signUp(browser);
  try {
    // Presence goes to followers: Bob follows Alice.
    const follow = await bob.page.request.put(`/api/users/${alice.id}/follow`);
    expect(follow.ok()).toBe(true);

    // Both sockets connect straight to the API's origin, authenticated by a socket token.
    const bobSocket = socketAccepted(bob.page);
    await bob.page.goto(`/chat?with=${alice.id}`);
    await expect(bob.page.getByPlaceholder('Scrivi un consiglio musicale…')).toBeVisible();
    const aliceSocket = socketAccepted(alice.page);
    await alice.page.goto('/');
    for (const url of await Promise.all([bobSocket, aliceSocket])) {
      expect(new URL(url).host).toBe(new URL(API_URL).host);
    }

    // Alice toggles Ghost Mode over her socket; Bob's open conversation updates live.
    const peerStatus = bob.page.getByText(`@${alice.username} ·`);
    await alice.page.getByTitle('Attiva Ghost Mode').click();
    await expect(peerStatus).toHaveText(`@${alice.username} · in Ghost Mode`);
    await alice.page.getByTitle('Disattiva Ghost Mode').click();
    await expect(peerStatus).toHaveText(`@${alice.username} · online`);

    // Alice writes; Bob's open thread shows it without a reload (socket `chat:message`).
    const text = `Messaggio live ${Date.now()}`;
    const sent = await alice.page.request.post('/api/chat/messages', {
      data: { receiverId: bob.id, content: text },
    });
    expect(sent.status()).toBe(201);
    await expect(bob.page.getByRole('log').getByText(text)).toBeVisible();

    // Alice leaves: her last socket closes and Bob sees her go offline.
    await alice.page.close();
    await expect(peerStatus).toBeHidden();
    await expect(bob.page.getByText(`@${alice.username}`, { exact: true })).toBeVisible();
  } finally {
    await alice.context.close();
    await bob.context.close();
  }
});
