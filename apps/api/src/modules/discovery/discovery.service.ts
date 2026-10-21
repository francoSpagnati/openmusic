import type { PrismaClient } from '@prisma/client';
import type {
  DiscoveryReelItem,
  DiscoveryFeedResponse,
  GenreRouletteResult,
  CatalogTrack,
} from '@openmusic/shared';
import type { AudioPreviewResolverService } from '../catalog/audio-preview-resolver.service';

interface CuratedGenre {
  name: string;
  tagline: string;
  context: string;
  sampleQueries: Array<{ title: string; artist: string }>;
}

const CURATED_OUT_OF_BUBBLE_GENRES: CuratedGenre[] = [
  {
    name: 'City Pop',
    tagline: "Il funk-pop giapponese anni '80 tra luci al neon e tramonti a Tokyo",
    context:
      'Un genere che fonde jazz fusion, funk e synth-pop, perfetto per viaggi notturni in auto.',
    sampleQueries: [
      { title: 'Plastic Love', artist: 'Mariya Takeuchi' },
      { title: 'Stay With Me', artist: 'Miki Matsubara' },
      { title: 'Midnight Pretenders', artist: 'Tomoko Aran' },
    ],
  },
  {
    name: 'Shoegaze',
    tagline: 'Muri di chitarre riverberate, feedback ipnotico e melodie sommerse',
    context:
      'Nato nel Regno Unito nei tardi anni 80, mette il volume e le texture sonore al centro.',
    sampleQueries: [
      { title: 'When You Sleep', artist: 'My Bloody Valentine' },
      { title: 'Alison', artist: 'Slowdive' },
      { title: 'Vapour Trail', artist: 'Ride' },
    ],
  },
  {
    name: 'Math Rock',
    tagline: 'Tempi dispari, tapping acrobatico e precisione geometrica',
    context:
      'Evoluzione del post-hardcore e del progressive con firme ritmiche inusuali (es. 7/8, 11/8).',
    sampleQueries: [
      { title: 'Never Meant', artist: 'American Football' },
      { title: 'Atlas', artist: 'Battles' },
      { title: 'Chon', artist: 'Bubble Dream' },
    ],
  },
  {
    name: 'Bossa Nova',
    tagline: 'Accordi di chitarra sofisticati, sussurri e brezza di Rio de Janeiro',
    context: 'Nata a fine anni 50 dalla fusione tra samba brasiliano e armonie del cool jazz.',
    sampleQueries: [
      { title: 'Garota de Ipanema', artist: 'Stan Getz & Astrud Gilberto' },
      { title: 'Chega de Saudade', artist: 'Joao Gilberto' },
      { title: 'Aguas de Marco', artist: 'Elis Regina & Antonio Carlos Jobim' },
    ],
  },
  {
    name: 'Post-Rock',
    tagline: 'Crescendi orchestrali epici, pause dilatate e dinamiche cinematiche',
    context:
      'Usa strumenti rock convenzionali per creare atmosfere quasi sinfoniche prive di parti vocali.',
    sampleQueries: [
      { title: 'Your Hand in Mine', artist: 'Explosions in the Sky' },
      { title: 'Moya', artist: 'Godspeed You! Black Emperor' },
      { title: 'Starálfur', artist: 'Sigur Rós' },
    ],
  },
  {
    name: 'Krautrock',
    tagline: 'Il ritmo "motorik" tedesco, sintetizzatori analogici e cosmicità',
    context:
      'Movimento pionieristico degli anni 70 in Germania che ha gettato le basi della musica elettronica moderna.',
    sampleQueries: [
      { title: 'Hallogallo', artist: 'Neu!' },
      { title: 'Autobahn', artist: 'Kraftwerk' },
      { title: 'Vitamin C', artist: 'Can' },
    ],
  },
];

export class DiscoveryService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly previewResolver: AudioPreviewResolverService
  ) {}

  /**
   * Feed verticale dei Reels con clip audio 30s pronte per avvio istantaneo (< 400ms)
   */
  async getReelsFeed(userId?: string, limit = 10): Promise<DiscoveryFeedResponse> {
    // 1. Preleva tracce con anteprima audio già presente o generabile
    const tracks = await this.prisma.track.findMany({
      where: {
        previewUrl: { not: null },
      },
      include: {
        release: {
          include: {
            reviews: {
              where: { content: { not: null } },
              orderBy: { rating: 'desc' },
              take: 1,
              include: {
                user: {
                  select: { username: true, avatarUrl: true },
                },
              },
            },
          },
        },
      },
      take: limit,
      orderBy: { id: 'desc' },
    });

    const items: DiscoveryReelItem[] = tracks.map((t) => {
      const topReview = t.release.reviews[0];

      return {
        id: `reel-${t.id}`,
        track: {
          id: t.id,
          isrc: t.isrc,
          title: t.title,
          artistName: t.artistName,
          durationMs: t.durationMs,
          previewUrl: t.previewUrl,
          releaseId: t.releaseId,
          coverUrl: t.release.coverUrl,
        },
        release: {
          id: t.release.id,
          title: t.release.title,
          artistName: t.release.artistName,
          releaseType: t.release.releaseType as 'ALBUM' | 'SINGLE' | 'EP',
          coverUrl: t.release.coverUrl,
          dominantColor: t.release.dominantColor ?? '#26262B',
          releaseDate: t.release.releaseDate?.toISOString() ?? null,
          genres: t.release.genres,
          audienceAvg: t.release.audienceAvg,
          audienceFreshPct: t.release.audienceFreshPct,
          audienceCount: t.release.audienceCount,
          criticAvg: t.release.criticAvg,
          criticFreshPct: t.release.criticFreshPct,
          criticCount: t.release.criticCount,
        },
        topReviewSnippet: topReview
          ? {
              id: topReview.id,
              authorName: topReview.user.username,
              authorAvatarUrl: topReview.user.avatarUrl,
              rating: topReview.rating,
              snippet: (topReview.content ?? '').slice(0, 140),
              isVerifiedListen: topReview.isVerifiedListen,
            }
          : null,
        isSaved: false,
      };
    });

    return {
      items,
      nextCursor: null,
    };
  }

  /**
   * Roulette Russa dei Generi (Algoritmo "Out-of-the-bubble")
   */
  async spinGenreRoulette(userId?: string): Promise<GenreRouletteResult> {
    const userGenres = new Set<string>();

    if (userId) {
      // Estrai generi già ascoltati dall'utente
      const userScrobbles = await this.prisma.scrobbleLog.findMany({
        where: { userId },
        include: { release: { select: { genres: true } } },
        take: 50,
      });

      for (const s of userScrobbles) {
        if (s.release?.genres) {
          for (const g of s.release.genres) {
            userGenres.add(g.toLowerCase());
          }
        }
      }
    }

    // Filtra generi curati scartando quelli già dominanti nell'utente
    const candidates = CURATED_OUT_OF_BUBBLE_GENRES.filter(
      (g) => !userGenres.has(g.name.toLowerCase())
    );

    const pool = candidates.length > 0 ? candidates : CURATED_OUT_OF_BUBBLE_GENRES;
    const selectedGenre = pool[Math.floor(Math.random() * pool.length)];
    if (!selectedGenre) throw new Error('Genre roulette pool is empty');

    // Risolvi le 3 tracce con anteprima audio a cascata (ADR-003)
    const starterTracks: CatalogTrack[] = [];

    for (const sample of selectedGenre.sampleQueries) {
      const previewRes = await this.previewResolver.resolvePreview(sample.title, sample.artist);

      starterTracks.push({
        id: `sample-${encodeURIComponent(sample.artist)}-${encodeURIComponent(sample.title)}`,
        title: sample.title,
        artistName: sample.artist,
        durationMs: 180000,
        previewUrl: previewRes.previewUrl,
        coverUrl: null,
      });
    }

    return {
      genre: selectedGenre.name,
      tagline: selectedGenre.tagline,
      context: selectedGenre.context,
      starterTracks,
    };
  }
}
