# @openmusic/mobile

Expo app (iOS/Android) on the real OpenMusic API. Same contracts (`@openmusic/shared`), same
design tokens (`THEME`) and the same typed client surface as `apps/web`.

## Stack and why

- **Expo SDK 58** (React Native 0.88, React 19.3, New Architecture). Upgraded from SDK 51
  because the store build of Expo Go only runs the latest SDK: on 51 the app could no longer be
  opened in Expo Go. Versions match `expo/bundledNativeModules.json` for SDK 58.
- **expo-router** (file-based routes in `app/`), JS bottom tabs (`expo-router/js-tabs`).
- **expo-secure-store** for the session JWT, **expo-image** for covers, **expo-font** +
  `@expo-google-fonts/*` (Fraunces, Plus Jakarta Sans, JetBrains Mono, bundled offline).
- **Jest 30 + jest-expo + @testing-library/react-native 14**.

## Run

```bash
cp apps/mobile/.env.example apps/mobile/.env   # set EXPO_PUBLIC_API_URL (LAN IP on a device)
npm run dev:api                                 # from the repo root
npm run dev:mobile                              # expo start → scan with Expo Go
```

Seed users log in with `openmusic-dev` (e.g. `francospagnati@openmusic.test`).

| Script (in apps/mobile) | What it does                                                     |
| ----------------------- | ---------------------------------------------------------------- |
| `npm run typecheck`     | `tsc --noEmit` (strict)                                          |
| `npm test`              | Jest (client, auth, primitives, real route tree)                 |
| `npm run export:smoke`  | `expo export --platform android` into `dist-smoke/` (bundles JS) |

Without network access to `api.expo.dev`, prefix Expo CLI commands with `EXPO_OFFLINE=1`.

## Layout

```
app/                         expo-router routes
  _layout.tsx                fonts, providers, Stack.Protected auth gate
  (auth)/login, register     anonymous only
  (tabs)/index               Home feed       (tabs)/explore   Esplora (catalog search)
  (tabs)/reels               Reels           (tabs)/chat      Chat inbox
  (tabs)/profile             Own profile
  release/[id]  profile/[id]  chat/[userId]  notifications  settings   (signed-in)
src/lib/api/                 typed client (Bearer), ApiError, tokenStore
src/lib/auth/                AuthProvider / useAuth
src/lib/socket.ts            useSocket, useSocketEvent, useFriendsPresence (JWT handshake)
src/lib/useApiQuery.ts       tiny fetch hook (loading / error / refresh / setData)
src/hooks/useNowPlayingSocket.ts   presence + Ghost Mode on top of useFriendsPresence
src/theme/                   useTheme() (THEME.scheme light/dark), FONT, typeScale, withAlpha
src/components/ui/           primitives mirroring apps/web/src/components/ui
src/components/domain/       PostCard, ReleaseRow, ProfileHeader
src/components/icons.ts      the Phosphor icons we use, imported one file each
src/components/*.tsx         pre-router presentational components (not wired yet)
```

## API client

```ts
import { api, isApiError } from '../src/lib/api'; // relative path from app/
const page = await api.feed.list({ scope: 'following' });
const results = await api.catalog.search({ q: 'ok computer', type: 'releases' });
```

- Every call validates the response with the shared Zod schema and throws `ApiError`
  (`status`, `code`, `message`, `fieldErrors`, `fieldError(name)`); `status 0` = network/timeout
  (15 s), `INVALID_RESPONSE` = contract mismatch.
- `Authorization: Bearer <jwt>` when signed in, `credentials: 'omit'` (no cookies on native).
- A 401 on a request that carried the current token calls the `AuthProvider`, which clears the
  token and shows the login stack.
- **Password change**: the API revokes every token (`sessionVersion`) and returns a fresh
  `{ token, expiresAt }`; `useAuth().changePassword` stores it, which also reopens the socket.
- Spotify/Last.fm linking is web-only for now (the OAuth `state` lives in a cookie).

## Monorepo gotcha: two Reacts

`apps/web` pins React 18 at the workspace root while SDK 58 needs React 19.3. npm installs the
mobile copies in `apps/mobile/node_modules` and hoists most Expo packages to the root, where a
plain lookup would find React 18. `tooling/mobile-first.js` fixes this for **Metro**
(`metro.config.js`) and **Jest** (`tooling/jest-resolver.js`): a file outside `apps/mobile` that
imports a package which also exists in `apps/mobile/node_modules` gets the mobile copy. The
exported bundle contains exactly one React and one React Native. Do not add `paths` for `react`
in `tsconfig.json`: Metro and jest-expo both honour tsconfig paths and would resolve `.d.ts`
files. `app.json` sets `experiments.tsconfigPaths: false`, so use relative imports.

## Notes for screen owners

- Screens marked `SKELETON` are minimal but on the real API; build on them.
- Prefer `src/components/ui` primitives and `useTheme()`; never hard-code colours.
- Avoid style keys named `value` (`{ value: 14 }` → `d.value`): the Reanimated Babel plugin
  treats `x.value` inside a style as a shared value and rewrites it.

## Discovery screens (Esplora, Reels, release page)

Code in `src/features/mobile-discovery/`, routes in `app/(tabs)/explore.tsx`, `app/(tabs)/reels.tsx`,
`app/release/[id].tsx`.

- **Catalog data is real**: search, browse and release pages read the API, which imports releases
  from Deezer / iTunes / MusicBrainz / Cover Art Archive. Rows show where a cover came from
  (`coverSource`), the search header lists the databases behind the current pages (`sources`).
  Search pages are merged by id (the API may repeat an item on a later page).
- **30s previews** (`PreviewPlayer.tsx`, expo-audio): one player per screen, stopped on blur and
  in background, plays in silent mode on iOS. URLs come from `track.previewUrl` or
  `GET /api/catalog/preview` (Spotify → Deezer → iTunes), cached per ISRC / artist+title
  (`preview.ts`). Reels autoplay the snapped reel (looping) and pre-buffer N+1 and N+2 with
  `expo-audio`'s `preload()` plus `Image.prefetch` for covers.
- **Reels actions** (thumb zone, bottom right): Indietro (previous reel), Salva (adds the track to
  the private playlist "Scoperte dai Reels", created on first save), Non fa per me (hides the reel,
  with an "Annulla" snackbar), play/pause. Screen readers get them as custom actions on the card.
- **Release page**: header tinted with `dominantColor`, dual score, tracklist split into sides A/B
  (disc boundary, else the track boundary nearest half the running time), review composer
  (upsert), audience reviews with the four reactions (optimistic, rolled back on error), critic
  quotes, videos (open in the browser / YouTube app).
- Tests: `src/features/mobile-discovery/__tests__` render the real routes with a fake `fetch`
  (fixtures in `testing/fixtures.ts`, shaped like Deezer imports) and a fake expo-audio player.

Known gaps (API side): a saved reel cannot be un-saved (no endpoint removes a playlist track);
`/api/discovery/reels` has no cursor parameter, so the feed ends after one page with a reload
card; reels are not personalised by "Non fa per me" (local only).
