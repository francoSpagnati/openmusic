# Catalog fixtures

Recorded-style responses used by `apps/api/test/catalog-*.test.ts` through an injected `fetch`
(the test sandbox has no outbound network). They follow the documented shapes of:

- Deezer API — `/search/album`, `/search/track`, `/album/{id}`, `/album/{id}/tracks`, `/track/{id}`,
  and the HTTP-200 error payload (`code` 4 = quota, 800 = no data).
- iTunes Search API — `/search?entity=album|song`, `/lookup?id=…&entity=song`.
- MusicBrainz WS/2 (JSON) — `/release?query=…`, `/release/{mbid}?inc=…`, `/release-group/{mbid}`,
  `/isrc/{isrc}`.
- Cover Art Archive — `/release/{mbid}` (note the `http://` image links CAA still returns).

Ids, hashes and preview tokens are illustrative, not real. To check the providers against the live
services run `npm run catalog:smoke` from the repository root.
