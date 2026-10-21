import type { Prisma, PrismaClient } from '@openmusic/db';
import type {
  CatalogRelease,
  CatalogTrack,
  GenreList,
  ReleasePage,
  SearchResult,
} from '@openmusic/shared';
import { nextCursorOf } from '../../lib/mappers';
import type { AudioPreviewResolverService } from './audio-preview-resolver.service';

export class CatalogService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly previewResolver: AudioPreviewResolverService
  ) {}

  /**
   * Cerca album e brani nel DB locale e, se necessario, arricchisce i risultati tramite API pubbliche.
   */
  async search(query: string): Promise<SearchResult> {
    const trimmed = query.trim();
    if (!trimmed) {
      return { releases: [], tracks: [] };
    }

    // 1. Cerca nel DB locale (Prisma)
    const dbReleases = await this.prisma.release.findMany({
      where: {
        OR: [
          { title: { contains: trimmed, mode: 'insensitive' } },
          { artistName: { contains: trimmed, mode: 'insensitive' } },
        ],
      },
      include: { tracks: true },
      take: 10,
    });

    const dbTracks = await this.prisma.track.findMany({
      where: {
        OR: [
          { title: { contains: trimmed, mode: 'insensitive' } },
          { artistName: { contains: trimmed, mode: 'insensitive' } },
        ],
      },
      include: { release: true },
      take: 10,
    });

    // Se abbiamo già dati locali sufficienti, ritorniamo subito
    if (dbReleases.length > 0 || dbTracks.length > 0) {
      return {
        releases: dbReleases.map((r) => this.mapRelease(r)),
        tracks: dbTracks.map((t) => this.mapTrack(t, t.release.coverUrl)),
      };
    }

    // 2. Se vuoto in locale, interroga Deezer API pubblica per indicizzare istantaneamente l'opera
    try {
      const deezerSearchUrl = `https://api.deezer.com/search?q=${encodeURIComponent(trimmed)}&limit=5`;
      const response = await fetch(deezerSearchUrl);

      if (response.ok) {
        const data = (await response.json()) as {
          data?: Array<{
            id: number;
            title: string;
            duration: number;
            preview: string;
            artist: { name: string };
            album: { id: number; title: string; cover_medium?: string };
          }>;
        };

        if (data.data && data.data.length > 0) {
          const releasesMap = new Map<string, CatalogRelease>();
          const tracksList: CatalogTrack[] = [];

          for (const item of data.data) {
            const albumTitle = item.album.title;
            const artistName = item.artist.name;
            const coverUrl = item.album.cover_medium ?? null;

            // Upsert release nel DB locale
            const release = await this.prisma.release.upsert({
              where: { id: `deezer-alb-${item.album.id}` },
              update: {},
              create: {
                id: `deezer-alb-${item.album.id}`,
                title: albumTitle,
                artistName,
                coverUrl,
                releaseType: 'ALBUM',
              },
            });

            // Upsert traccia nel DB locale
            const track = await this.prisma.track.upsert({
              where: { id: `deezer-trk-${item.id}` },
              update: {},
              create: {
                id: `deezer-trk-${item.id}`,
                deezerId: item.id.toString(),
                title: item.title,
                artistName,
                durationMs: item.duration * 1000,
                previewUrl: item.preview,
                releaseId: release.id,
              },
            });

            if (!releasesMap.has(release.id)) {
              releasesMap.set(release.id, this.mapRelease(release));
            }

            tracksList.push(this.mapTrack(track, coverUrl));
          }

          return {
            releases: Array.from(releasesMap.values()),
            tracks: tracksList,
          };
        }
      }
    } catch {
      // Ignora errori di rete esterni
    }

    return { releases: [], tracks: [] };
  }

  async getReleaseById(id: string): Promise<CatalogRelease | null> {
    const release = await this.prisma.release.findUnique({
      where: { id },
      include: {
        tracks: true,
      },
    });

    if (!release) return null;
    return this.mapRelease(release, release.tracks);
  }

  /** Explore page: releases optionally filtered by genre (case-insensitive exact match). */
  async browseReleases(query: {
    genre?: string;
    sort: 'popular' | 'recent';
    cursor?: string;
    limit: number;
  }): Promise<ReleasePage> {
    const orderBy: Prisma.ReleaseOrderByWithRelationInput[] =
      query.sort === 'recent'
        ? [{ releaseDate: { sort: 'desc', nulls: 'last' } }, { id: 'asc' }]
        : [{ audienceCount: 'desc' }, { id: 'asc' }];
    let where: Prisma.ReleaseWhereInput = {};
    if (query.genre) {
      const genres = await this.listGenres();
      const match = genres.find((g) => g.name.toLowerCase() === query.genre?.toLowerCase());
      where = { genres: { has: match?.name ?? query.genre } };
    }
    const rows = await this.prisma.release.findMany({
      where,
      orderBy,
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });
    const page = nextCursorOf(rows, query.limit);
    return { items: page.items.map((r) => this.mapRelease(r)), nextCursor: page.nextCursor };
  }

  /** Distinct genres across the catalog with release counts, most common first. */
  async listGenres(): Promise<GenreList> {
    const rows = await this.prisma.$queryRaw<Array<{ name: string; count: bigint }>>`
      SELECT g AS name, COUNT(*) AS count
      FROM "Release", unnest("genres") AS g
      GROUP BY g
      ORDER BY count DESC, g ASC
    `;
    return rows.map((r) => ({ name: r.name, releaseCount: Number(r.count) }));
  }

  async resolveTrackPreview(title: string, artist: string, isrc?: string) {
    return this.previewResolver.resolvePreview(title, artist, isrc);
  }

  private mapRelease(
    r: {
      id: string;
      title: string;
      artistName: string;
      releaseType: string;
      coverUrl: string | null;
      dominantColor: string | null;
      releaseDate: Date | null;
      genres: string[];
      audienceAvg: number | null;
      audienceFreshPct: number | null;
      audienceCount: number;
      criticAvg: number | null;
      criticFreshPct: number | null;
      criticCount: number;
    },
    tracks?: Array<{
      id: string;
      isrc: string | null;
      title: string;
      artistName: string;
      durationMs: number;
      previewUrl: string | null;
      releaseId: string;
    }>
  ): CatalogRelease {
    return {
      id: r.id,
      title: r.title,
      artistName: r.artistName,
      releaseType: r.releaseType as 'ALBUM' | 'SINGLE' | 'EP',
      coverUrl: r.coverUrl,
      dominantColor: r.dominantColor ?? '#26262B',
      releaseDate: r.releaseDate?.toISOString() ?? null,
      genres: r.genres,
      audienceAvg: r.audienceAvg,
      audienceFreshPct: r.audienceFreshPct,
      audienceCount: r.audienceCount,
      criticAvg: r.criticAvg,
      criticFreshPct: r.criticFreshPct,
      criticCount: r.criticCount,
      tracks: tracks?.map((t) => this.mapTrack(t, r.coverUrl)),
    };
  }

  private mapTrack(
    t: {
      id: string;
      isrc?: string | null;
      title: string;
      artistName: string;
      durationMs: number;
      previewUrl: string | null;
      releaseId: string;
    },
    coverUrl?: string | null
  ): CatalogTrack {
    return {
      id: t.id,
      isrc: t.isrc ?? null,
      title: t.title,
      artistName: t.artistName,
      durationMs: t.durationMs,
      previewUrl: t.previewUrl,
      releaseId: t.releaseId,
      coverUrl: coverUrl ?? null,
    };
  }
}
