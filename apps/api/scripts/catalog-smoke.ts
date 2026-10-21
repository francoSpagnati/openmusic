/**
 * Live connectivity check of every external catalog provider (no database needed):
 *
 *   npm run catalog:smoke
 *
 * Exits 1 when any provider fails. Network failures (e.g. a sandbox proxy answering 403 to
 * CONNECT) are reported as such: nothing here is mocked.
 */
import { dominantColorOf } from '../src/lib/dominant-color';
import { MemoryResponseCache } from '../src/lib/upstream';
import { createCatalogProviders, musicBrainzUserAgent } from '../src/modules/catalog/providers';
import { env } from '../src/config/env';

interface Check {
  name: string;
  run: () => Promise<string>;
}

const providers = createCatalogProviders({
  cache: new MemoryResponseCache(),
  musicbrainzContact: env.MUSICBRAINZ_CONTACT,
  itunesCountry: env.ITUNES_COUNTRY,
});

let deezerCover: string | null = null;
let mbid: string | null = null;

const checks: Check[] = [
  {
    name: 'Deezer search/album',
    run: async () => {
      const page = await providers.deezer.searchAlbums('artist:"Radiohead" album:"In Rainbows"', {
        limit: 5,
        offset: 0,
      });
      const hit = page.items[0];
      if (!hit) throw new Error('no results');
      return `${page.items.length} hits, first: ${hit.title} (${hit.externalId})`;
    },
  },
  {
    name: 'Deezer album detail + tracklist',
    run: async () => {
      const hit = (
        await providers.deezer.searchAlbums('In Rainbows Radiohead', { limit: 1, offset: 0 })
      ).items[0];
      if (!hit) throw new Error('no album to open');
      const album = await providers.deezer.getAlbum(hit.externalId);
      if (!album) throw new Error('album not found');
      deezerCover = album.coverUrl;
      const isrcs = album.tracks?.filter((t) => t.isrc).length ?? 0;
      return `${album.title}: ${album.tracks?.length ?? 0} tracks (${isrcs} with ISRC), UPC ${album.upc ?? 'n/a'}, label ${album.label ?? 'n/a'}`;
    },
  },
  {
    name: 'Deezer cover -> dominant color',
    run: async () => {
      if (!deezerCover) throw new Error('no cover from the previous check');
      const thumb = providers.thumbnailFor(deezerCover);
      if (!thumb) throw new Error(`unsupported cover host: ${deezerCover}`);
      const bytes = await providers.images.getBytes(thumb, 2 * 1024 * 1024);
      if (!bytes) throw new Error('image not found');
      return `${bytes.length} bytes, color ${dominantColorOf(bytes) ?? 'undecodable'}`;
    },
  },
  {
    name: 'iTunes search',
    run: async () => {
      const page = await providers.itunes.searchAlbums('Radiohead In Rainbows', 3);
      const hit = page.items[0];
      if (!hit) throw new Error('no results');
      return `${hit.title} (${hit.externalId}), artwork ${hit.coverUrl ?? 'n/a'}`;
    },
  },
  {
    name: 'MusicBrainz release search + lookup',
    run: async () => {
      const hits = await providers.musicbrainz.searchReleases({
        title: 'In Rainbows',
        artist: 'Radiohead',
      });
      const best = hits[0];
      if (!best) throw new Error('no results');
      mbid = best.mbid;
      const release = await providers.musicbrainz.getRelease(best.mbid);
      return `${best.title} (${best.mbid}, score ${best.score}), ${release?.tracks?.length ?? 0} tracks, UA "${musicBrainzUserAgent(env.MUSICBRAINZ_CONTACT)}"`;
    },
  },
  {
    name: 'Cover Art Archive front cover',
    run: async () => {
      if (!mbid) throw new Error('no MBID from the previous check');
      const cover = await providers.coverArt.getFrontCover(mbid);
      return cover ? cover.url : 'no artwork for this release (404 is a valid answer)';
    },
  },
];

async function main(): Promise<void> {
  let failed = 0;
  for (const check of checks) {
    const started = Date.now();
    try {
      const detail = await check.run();
      console.log(`PASS  ${check.name} (${Date.now() - started} ms): ${detail}`);
    } catch (err) {
      failed++;
      console.log(
        `FAIL  ${check.name} (${Date.now() - started} ms): ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  console.log(
    failed === 0 ? 'All providers reachable.' : `${failed}/${checks.length} checks failed.`
  );
  if (failed > 0) process.exitCode = 1;
}

void main();
