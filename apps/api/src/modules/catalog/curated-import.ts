import { z } from 'zod';
import type { PrismaClient } from '@openmusic/db';
import { catalogMatchKey, normalizeCatalogText } from '@openmusic/shared';
import type { CatalogEnrichmentService } from './catalog-enrichment.service';
import { mergeGenres, type CatalogImportService } from './catalog-import.service';
import type { CatalogProviders } from './providers';
import type { ProviderRelease } from './providers/types';

export const CuratedAlbumSchema = z.object({
  artist: z.string().min(1),
  title: z.string().min(1),
  year: z.number().int().min(1900).max(2100).optional(),
  /** Pins an exact Deezer edition (skips the search). */
  deezerId: z.string().regex(/^\d+$/).optional(),
  upc: z
    .string()
    .regex(/^\d{8,14}$/)
    .optional(),
  /** OpenMusic explore categories, merged before the provider genres. */
  genres: z.array(z.string().min(1)).default([]),
});

export const CuratedFileSchema = z.object({ albums: z.array(CuratedAlbumSchema).min(1) });

export type CuratedAlbum = z.infer<typeof CuratedAlbumSchema>;

export interface CuratedImportOptions {
  dryRun: boolean;
  enrich: boolean;
  /** Only albums that already exist locally (the dev seed): upgrades them in place. */
  onlyLocal: boolean;
}

export interface CuratedImportResult {
  entry: CuratedAlbum;
  status: 'imported' | 'not-found' | 'skipped' | 'failed';
  source?: 'DEEZER' | 'ITUNES';
  releaseId?: string;
  externalId?: string;
  tracks?: number;
  dominantColor?: string | null;
  enrichment?: string;
  error?: string;
}

export interface CuratedImportDeps {
  prisma: PrismaClient;
  providers: CatalogProviders;
  importer: CatalogImportService;
  enrichment: CatalogEnrichmentService;
}

function yearOf(release: ProviderRelease): number | null {
  return release.releaseDate ? Number(release.releaseDate.slice(0, 4)) : null;
}

/** Finds the album on Deezer (pinned id, UPC or search), falling back to iTunes. */
export async function findCuratedAlbum(
  providers: CatalogProviders,
  entry: CuratedAlbum
): Promise<ProviderRelease | null> {
  if (entry.deezerId) return providers.deezer.getAlbum(entry.deezerId);
  if (entry.upc) {
    const byUpc = await providers.deezer.getAlbumByUpc(entry.upc);
    if (byUpc) return byUpc;
  }

  const key = catalogMatchKey(entry.title, entry.artist);
  const exactTitle = normalizeCatalogText(entry.title);
  const rank = (r: ProviderRelease) =>
    (normalizeCatalogText(r.title) === exactTitle ? 0 : 2) + (r.releaseType === 'ALBUM' ? 0 : 1);

  const hits = await providers.deezer.searchAlbums(
    `artist:"${entry.artist}" album:"${entry.title}"`,
    { limit: 15, offset: 0 }
  );
  const candidates = hits.items
    .filter((r) => catalogMatchKey(r.title, r.artist.name) === key)
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, 3);
  let fallback: ProviderRelease | null = null;
  for (const candidate of candidates) {
    const detail = await providers.deezer.getAlbum(candidate.externalId);
    if (!detail) continue;
    const year = yearOf(detail);
    // Reissues carry the reissue date: accept them only if nothing closer exists.
    if (!entry.year || year === null || Math.abs(year - entry.year) <= 1) return detail;
    fallback ??= detail;
  }
  if (fallback) return fallback;

  const itunes = await providers.itunes.searchAlbums(`${entry.artist} ${entry.title}`, 10);
  const match = itunes.items
    .filter((r) => catalogMatchKey(r.title, r.artist.name) === key)
    .sort((a, b) => rank(a) - rank(b))[0];
  return match ? providers.itunes.getAlbum(match.externalId) : null;
}

/** Imports curated albums one by one; one failure never stops the batch. */
export async function importCuratedAlbums(
  deps: CuratedImportDeps,
  entries: readonly CuratedAlbum[],
  options: CuratedImportOptions,
  onResult: (result: CuratedImportResult) => void = () => undefined
): Promise<CuratedImportResult[]> {
  const results: CuratedImportResult[] = [];
  for (const entry of entries) {
    let result: CuratedImportResult;
    try {
      result = await importOne(deps, entry, options);
    } catch (err) {
      result = { entry, status: 'failed', error: err instanceof Error ? err.message : String(err) };
    }
    results.push(result);
    onResult(result);
  }
  return results;
}

async function importOne(
  deps: CuratedImportDeps,
  entry: CuratedAlbum,
  options: CuratedImportOptions
): Promise<CuratedImportResult> {
  if (options.onlyLocal) {
    const key = catalogMatchKey(entry.title, entry.artist);
    const local = await deps.prisma.release.findMany({
      where: {
        OR: [
          { matchKey: key },
          { matchKey: null, title: { equals: entry.title, mode: 'insensitive' } },
        ],
      },
      select: { title: true, artistName: true },
    });
    if (!local.some((r) => catalogMatchKey(r.title, r.artistName) === key)) {
      return { entry, status: 'skipped' };
    }
  }

  const found = await findCuratedAlbum(deps.providers, entry);
  if (!found) return { entry, status: 'not-found' };
  const source = found.provider === 'ITUNES' ? 'ITUNES' : 'DEEZER';
  if (options.dryRun) {
    return {
      entry,
      status: 'imported',
      source,
      externalId: found.externalId,
      tracks: found.tracks?.length ?? 0,
    };
  }

  const { release } = await deps.importer.importRelease(found);
  if (entry.genres.length > 0) {
    const current = await deps.prisma.release.findUniqueOrThrow({
      where: { id: release.id },
      select: { genres: true },
    });
    const genres = mergeGenres(entry.genres, current.genres);
    await deps.prisma.release.update({ where: { id: release.id }, data: { genres } });
  }
  const dominantColor = await deps.importer.refreshDominantColor(release.id).catch(() => null);
  const enrichment = options.enrich ? await deps.enrichment.enrichRelease(release.id) : undefined;
  const tracks = await deps.prisma.track.count({ where: { releaseId: release.id } });
  return {
    entry,
    status: 'imported',
    source,
    releaseId: release.id,
    externalId: found.externalId,
    tracks,
    dominantColor,
    enrichment,
  };
}
