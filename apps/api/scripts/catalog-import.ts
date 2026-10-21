/**
 * Imports a curated list of real albums from Deezer (iTunes as fallback), with MusicBrainz /
 * Cover Art Archive enrichment and the dominant cover color.
 *
 *   npm run catalog:import -- --file curated-albums.json [--dry-run] [--no-enrich] [--limit 5]
 *   npm run catalog:import -- --seed-hook   # used by `npm run db:seed` (see below)
 *
 * --only-local  import only albums already in the local DB (upgrades the dev seed in place)
 * --if-online   exit 0 without doing anything when Deezer is unreachable
 * --seed-hook   = --only-local --if-online --no-enrich, skipped when CATALOG_SEED_IMPORT=false
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { prisma } from '@openmusic/db';
import { env } from '../src/config/env';
import { MemoryResponseCache } from '../src/lib/upstream';
import { CatalogEnrichmentService } from '../src/modules/catalog/catalog-enrichment.service';
import { CatalogImportService } from '../src/modules/catalog/catalog-import.service';
import {
  CuratedFileSchema,
  importCuratedAlbums,
  type CuratedImportResult,
} from '../src/modules/catalog/curated-import';
import { createCatalogProviders } from '../src/modules/catalog/providers';

function flag(name: string): boolean {
  return process.argv.includes(name);
}

function option(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

/** `--file x.json`: relative to where npm was run, else to apps/api/data. */
function resolveFile(file: string): string {
  const candidates = [
    path.resolve(process.env.INIT_CWD ?? process.cwd(), file),
    path.resolve(process.cwd(), file),
    path.resolve(__dirname, '../data', file),
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error(`File not found: ${file} (looked in ${candidates.join(', ')})`);
  return found;
}

function describe(r: CuratedImportResult): string {
  const name = `${r.entry.artist} — ${r.entry.title}`;
  switch (r.status) {
    case 'imported':
      return `OK      ${name}  [${r.source} ${r.externalId}] ${r.tracks ?? 0} tracks, color ${r.dominantColor ?? 'n/a'}${r.enrichment ? `, musicbrainz: ${r.enrichment}` : ''}`;
    case 'not-found':
      return `MISSING ${name}`;
    case 'skipped':
      return `SKIP    ${name} (not in the local catalog)`;
    default:
      return `FAILED  ${name}: ${r.error ?? 'unknown error'}`;
  }
}

async function main(): Promise<void> {
  const seedHook = flag('--seed-hook');
  if (seedHook && process.env.CATALOG_SEED_IMPORT === 'false') {
    console.log('[catalog:import] CATALOG_SEED_IMPORT=false: keeping the offline seed catalog.');
    return;
  }
  const file = resolveFile(option('--file') ?? 'curated-albums.json');
  const limit = Number(option('--limit') ?? '0');
  const options = {
    dryRun: flag('--dry-run'),
    enrich: !(flag('--no-enrich') || seedHook),
    onlyLocal: flag('--only-local') || seedHook,
  };
  const ifOnline = flag('--if-online') || seedHook;

  const parsed = CuratedFileSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
  const albums = limit > 0 ? parsed.albums.slice(0, limit) : parsed.albums;

  const providers = createCatalogProviders({
    cache: new MemoryResponseCache(),
    musicbrainzContact: env.MUSICBRAINZ_CONTACT,
    itunesCountry: env.ITUNES_COUNTRY,
  });

  try {
    await providers.deezer.searchArtists('Radiohead', 1);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    if (ifOnline) {
      console.log(
        `[catalog:import] Deezer not reachable (${reason}): keeping the offline catalog.`
      );
      return;
    }
    console.error(
      `[catalog:import] Deezer not reachable (${reason}). Run "npm run catalog:smoke".`
    );
    process.exitCode = 1;
    return;
  }

  const importer = new CatalogImportService(prisma, providers);
  const enrichment = new CatalogEnrichmentService(prisma, providers, importer);
  console.log(
    `[catalog:import] ${albums.length} albums from ${path.relative(process.cwd(), file)}` +
      `${options.dryRun ? ' (dry run)' : ''}${options.enrich ? ', MusicBrainz enrichment on (1 req/s)' : ''}`
  );
  const results = await importCuratedAlbums(
    { prisma, providers, importer, enrichment },
    albums,
    options,
    (r) => console.log(describe(r))
  );

  const count = (status: CuratedImportResult['status']) =>
    results.filter((r) => r.status === status).length;
  console.log(
    `[catalog:import] imported ${count('imported')}, missing ${count('not-found')}, ` +
      `skipped ${count('skipped')}, failed ${count('failed')}`
  );
  if (count('failed') > 0) process.exitCode = 1;
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
