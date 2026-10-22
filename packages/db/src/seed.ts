/**
 * OpenMusic development seed.
 *
 * Idempotent: every row is keyed by a deterministic UUID (or a natural unique key such as
 * username / ISRC) and written with `upsert`, so running `npm run db:seed` repeatedly converges
 * to the same state instead of duplicating data. Release aggregates (ADR-001 dual rating) are
 * recomputed from the seeded reviews, never hardcoded.
 *
 * ISRCs use a fictional registrant prefix (`ZZ` country + `OMS`) so they can never collide with real
 * recordings; the catalog sync replaces them with real codes when a release is matched.
 */
import { createHash, randomBytes, scryptSync } from 'node:crypto';
import {
  NotificationType,
  PrismaClient,
  Role,
  ReleaseType,
  ReactionType,
  type Prisma,
} from '@prisma/client';

const prisma = new PrismaClient();

/** Deterministic RFC 4122 v5-style UUID derived from a stable seed key. */
function seedId(key: string): string {
  const hex = createHash('sha1').update(`openmusic-seed:${key}`).digest('hex').slice(0, 32);
  const chars = hex.split('');
  chars[12] = '5';
  chars[16] = ((parseInt(chars[16] ?? '0', 16) & 0x3) | 0x8).toString(16);
  const h = chars.join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Every seeded account can sign in with this password (development only). Hashed in the same
 * `scrypt$N$r$p$salt$hash` format as apps/api/src/lib/password.ts.
 */
export const DEV_PASSWORD = 'openmusic-dev';

function hashDevPassword(password: string): string {
  const N = 2 ** 15;
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, 64, { N, r: 8, p: 1, maxmem: 256 * 1024 * 1024 });
  return ['scrypt', N, 8, 1, salt.toString('base64url'), key.toString('base64url')].join('$');
}

const daysAgo = (days: number, hours = 0): Date =>
  new Date(Date.now() - (days * 24 + hours) * 60 * 60 * 1000);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
interface SeedUser {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  role?: Role;
  criticOutlet?: string;
  isGhostMode?: boolean;
}

const USERS: SeedUser[] = [
  {
    username: 'francospagnati',
    displayName: 'Franco Spagnati',
    bio: 'Vinili, art-rock e psichedelia. Ascolti scrobblati in tempo reale.',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&h=160&fit=crop',
  },
  {
    username: 'giulia.rossi',
    displayName: 'Giulia Rossi',
    bio: 'Neo-soul, R&B e tutto quello che suona bene alle 2 di notte.',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160&h=160&fit=crop',
  },
  {
    username: 'marco_beats',
    displayName: 'Marco Bellini',
    bio: 'Produttore hip-hop da cameretta. Campiono jazz da quando avevo 15 anni.',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&h=160&fit=crop',
  },
  {
    username: 'sara.vinyl',
    displayName: 'Sara Conti',
    bio: 'Rock alternativo italiano anni 90. Collezionista compulsiva.',
    avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=160&h=160&fit=crop',
    isGhostMode: true,
  },
  {
    username: 'rumorebianco',
    displayName: 'Rumore Bianco',
    bio: 'Webzine indipendente di critica musicale. Firma accreditata OpenMusic.',
    avatarUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=160&h=160&fit=crop',
    role: Role.CRITIC,
    criticOutlet: 'Rumore Bianco',
  },
  {
    username: 'admin',
    displayName: 'OpenMusic Staff',
    bio: 'Account di amministrazione locale (verifica accrediti critici).',
    avatarUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=160&h=160&fit=crop',
    role: Role.ADMIN,
  },
];

// ---------------------------------------------------------------------------
// Releases & tracks
// ---------------------------------------------------------------------------
interface SeedTrack {
  title: string;
  durationMs: number;
}

interface SeedRelease {
  key: string;
  title: string;
  artistName: string;
  releaseType: ReleaseType;
  coverUrl: string;
  dominantColor: string;
  genres: string[];
  releaseDate: string;
  tracks: SeedTrack[];
  /** ADR-012: key of the release group (the album as a work); editions share it. */
  groupKey: string;
  /** Edition facts; omitted for the plain/original edition. */
  edition?: { label: string; format: string; country: string; recordLabel: string };
}

/**
 * ADR-012 release groups. `matchKey` is `releaseGroupMatchKey(title, artistName)` from
 * `@openmusic/shared` (lower-cased artist + work title without edition qualifiers and
 * punctuation), written out because this package does not depend on `shared`.
 */
interface SeedGroup {
  key: string;
  title: string;
  artistName: string;
  firstReleaseYear: number;
  matchKey: string;
}

const GROUPS: SeedGroup[] = [
  {
    key: 'in-rainbows',
    title: 'In Rainbows',
    artistName: 'Radiohead',
    firstReleaseYear: 2007,
    matchKey: 'radiohead|in rainbows',
  },
  {
    key: 'random-access-memories',
    title: 'Random Access Memories',
    artistName: 'Daft Punk',
    firstReleaseYear: 2013,
    matchKey: 'daft punk|random access memories',
  },
  {
    key: 'to-pimp-a-butterfly',
    title: 'To Pimp a Butterfly',
    artistName: 'Kendrick Lamar',
    firstReleaseYear: 2015,
    matchKey: 'kendrick lamar|to pimp a butterfly',
  },
  {
    key: 'blonde',
    title: 'Blonde',
    artistName: 'Frank Ocean',
    firstReleaseYear: 2016,
    matchKey: 'frank ocean|blonde',
  },
  {
    key: 'hai-paura-del-buio',
    title: 'Hai paura del buio?',
    artistName: 'Afterhours',
    firstReleaseYear: 1997,
    matchKey: 'afterhours|hai paura del buio',
  },
  {
    key: 'titanic-rising',
    title: 'Titanic Rising',
    artistName: 'Weyes Blood',
    firstReleaseYear: 2019,
    matchKey: 'weyes blood|titanic rising',
  },
];

const RELEASES: SeedRelease[] = [
  {
    key: 'in-rainbows',
    groupKey: 'in-rainbows',
    title: 'In Rainbows',
    artistName: 'Radiohead',
    releaseType: ReleaseType.ALBUM,
    coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&h=600&fit=crop',
    dominantColor: '#D97736',
    genres: ['Art Rock', 'Alternative Rock', 'Electronic'],
    releaseDate: '2007-10-10',
    tracks: [
      { title: '15 Step', durationMs: 237_000 },
      { title: 'Bodysnatchers', durationMs: 242_000 },
      { title: 'Nude', durationMs: 255_000 },
      { title: 'Weird Fishes/Arpeggi', durationMs: 318_000 },
      { title: 'Reckoner', durationMs: 290_000 },
      { title: 'Videotape', durationMs: 279_000 },
    ],
  },
  {
    key: 'random-access-memories',
    groupKey: 'random-access-memories',
    title: 'Random Access Memories',
    artistName: 'Daft Punk',
    releaseType: ReleaseType.ALBUM,
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&h=600&fit=crop',
    dominantColor: '#8E5A9E',
    genres: ['Disco', 'Funk', 'Electronic'],
    releaseDate: '2013-05-17',
    tracks: [
      { title: 'Give Life Back to Music', durationMs: 274_000 },
      { title: 'Instant Crush', durationMs: 337_000 },
      { title: 'Get Lucky', durationMs: 369_000 },
      { title: 'Touch', durationMs: 498_000 },
    ],
  },
  {
    key: 'to-pimp-a-butterfly',
    groupKey: 'to-pimp-a-butterfly',
    title: 'To Pimp a Butterfly',
    artistName: 'Kendrick Lamar',
    releaseType: ReleaseType.ALBUM,
    coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&h=600&fit=crop',
    dominantColor: '#2B2B2B',
    genres: ['Hip-Hop', 'Jazz Rap', 'Funk'],
    releaseDate: '2015-03-15',
    tracks: [
      { title: 'Wesley’s Theory', durationMs: 287_000 },
      { title: 'King Kunta', durationMs: 234_000 },
      { title: 'Alright', durationMs: 219_000 },
      { title: 'The Blacker the Berry', durationMs: 328_000 },
    ],
  },
  {
    key: 'blonde',
    groupKey: 'blonde',
    title: 'Blonde',
    artistName: 'Frank Ocean',
    releaseType: ReleaseType.ALBUM,
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600&h=600&fit=crop',
    dominantColor: '#B9A27E',
    genres: ['R&B', 'Alternative R&B', 'Art Pop'],
    releaseDate: '2016-08-20',
    tracks: [
      { title: 'Nikes', durationMs: 314_000 },
      { title: 'Ivy', durationMs: 249_000 },
      { title: 'Pink + White', durationMs: 184_000 },
      { title: 'Self Control', durationMs: 249_000 },
      { title: 'Nights', durationMs: 307_000 },
    ],
  },
  {
    key: 'hai-paura-del-buio',
    groupKey: 'hai-paura-del-buio',
    title: 'Hai paura del buio?',
    artistName: 'Afterhours',
    releaseType: ReleaseType.ALBUM,
    coverUrl: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=600&h=600&fit=crop',
    dominantColor: '#6E1F1F',
    genres: ['Alternative Rock', 'Rock Italiano'],
    releaseDate: '1997-03-01',
    tracks: [
      { title: 'Male di miele', durationMs: 228_000 },
      { title: 'Rapace', durationMs: 248_000 },
      { title: 'Voglio una pelle splendida', durationMs: 253_000 },
      { title: 'Non è per sempre', durationMs: 241_000 },
    ],
  },
  {
    key: 'titanic-rising',
    groupKey: 'titanic-rising',
    title: 'Titanic Rising',
    artistName: 'Weyes Blood',
    releaseType: ReleaseType.ALBUM,
    coverUrl: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=600&h=600&fit=crop',
    dominantColor: '#2F5D7C',
    genres: ['Chamber Pop', 'Soft Rock', 'Baroque Pop'],
    releaseDate: '2019-04-05',
    tracks: [
      { title: 'A Lot’s Gonna Change', durationMs: 263_000 },
      { title: 'Andromeda', durationMs: 282_000 },
      { title: 'Everyday', durationMs: 307_000 },
      { title: 'Movies', durationMs: 351_000 },
    ],
  },
  {
    // A second edition of the same work (ADR-012): its own row, tracks and reviews, linked to
    // the Random Access Memories group. Real reissue: Columbia, 12 May 2023.
    key: 'random-access-memories-10th',
    groupKey: 'random-access-memories',
    title: 'Random Access Memories (10th Anniversary Edition)',
    artistName: 'Daft Punk',
    releaseType: ReleaseType.ALBUM,
    coverUrl: 'https://images.unsplash.com/photo-1603048588665-791ca8aea617?w=600&h=600&fit=crop',
    dominantColor: '#3A3328',
    genres: ['Disco', 'Electronic', 'Funk'],
    releaseDate: '2023-05-12',
    edition: {
      label: '10th Anniversary Edition',
      format: 'Digital Media',
      country: 'XW',
      recordLabel: 'Columbia',
    },
    tracks: [
      { title: 'Give Life Back to Music', durationMs: 274_000 },
      { title: 'Get Lucky', durationMs: 369_000 },
      { title: 'Touch', durationMs: 498_000 },
      { title: 'Horizon Ocean Drive (Outtake)', durationMs: 412_000 },
      { title: 'GLBTM (Studio Outtakes)', durationMs: 384_000 },
      { title: 'Infinity Repeating (2013 Demo)', durationMs: 239_000 },
    ],
  },
];

const isrcFor = (releaseIndex: number, trackIndex: number): string =>
  `ZZOMS26${String(releaseIndex + 1).padStart(2, '0')}${String(trackIndex + 1).padStart(3, '0')}`;

const trackId = (releaseKey: string, title: string): string =>
  seedId(`track:${releaseKey}:${title}`);

// ---------------------------------------------------------------------------
// Social graph, scrobbles, reviews, reactions, playlists, chat
// ---------------------------------------------------------------------------
const FOLLOWS: Array<[follower: string, following: string]> = [
  ['francospagnati', 'giulia.rossi'],
  ['francospagnati', 'marco_beats'],
  ['francospagnati', 'rumorebianco'],
  ['giulia.rossi', 'francospagnati'],
  ['giulia.rossi', 'marco_beats'],
  ['marco_beats', 'francospagnati'],
  ['marco_beats', 'giulia.rossi'],
  ['sara.vinyl', 'francospagnati'],
  ['sara.vinyl', 'rumorebianco'],
];

/** Listens that back the ADR-004 "verified listen" badge. [username, releaseKey, trackTitle, daysAgo] */
const SCROBBLES: Array<[string, string, string, number]> = [
  ['francospagnati', 'in-rainbows', 'Weird Fishes/Arpeggi', 0],
  ['francospagnati', 'in-rainbows', 'Reckoner', 1],
  ['francospagnati', 'in-rainbows', 'Nude', 2],
  ['francospagnati', 'titanic-rising', 'Andromeda', 3],
  ['giulia.rossi', 'blonde', 'Nights', 0],
  ['giulia.rossi', 'blonde', 'Self Control', 1],
  ['giulia.rossi', 'blonde', 'Ivy', 4],
  ['marco_beats', 'to-pimp-a-butterfly', 'King Kunta', 0],
  ['marco_beats', 'to-pimp-a-butterfly', 'Alright', 2],
  ['marco_beats', 'random-access-memories', 'Get Lucky', 5],
  ['sara.vinyl', 'random-access-memories-10th', 'Horizon Ocean Drive (Outtake)', 2],
  ['sara.vinyl', 'hai-paura-del-buio', 'Male di miele', 1],
  ['sara.vinyl', 'hai-paura-del-buio', 'Rapace', 6],
];

interface SeedReview {
  username: string;
  releaseKey: string;
  rating: number; // 10..100 (ADR-001)
  content: string;
  vibeTags: string[];
  outletUrl?: string;
}

const REVIEWS: SeedReview[] = [
  {
    username: 'francospagnati',
    releaseKey: 'in-rainbows',
    rating: 100,
    content: 'Il disco più caldo dei Radiohead. Weird Fishes è un vortice da cui non si esce.',
    vibeTags: ['notturno', 'malinconico', 'ipnotico'],
  },
  {
    username: 'giulia.rossi',
    releaseKey: 'in-rainbows',
    rating: 90,
    content: 'Nude mi distrugge ogni volta. Produzione impeccabile.',
    vibeTags: ['intimo'],
  },
  {
    username: 'marco_beats',
    releaseKey: 'in-rainbows',
    rating: 60,
    content: 'Bello, ma preferisco il loro lato più elettronico.',
    vibeTags: ['rilassato'],
  },
  {
    username: 'giulia.rossi',
    releaseKey: 'blonde',
    rating: 100,
    content: 'Un diario sussurrato. Nights cambia pelle a metà e ti porta con sé.',
    vibeTags: ['notturno', 'estivo'],
  },
  {
    username: 'francospagnati',
    releaseKey: 'blonde',
    rating: 80,
    content: 'Minimalista e coraggioso, cresce a ogni ascolto.',
    vibeTags: ['sognante'],
  },
  {
    username: 'marco_beats',
    releaseKey: 'to-pimp-a-butterfly',
    rating: 100,
    content: 'Jazz, funk e spoken word: un manifesto. Ogni campione è una lezione.',
    vibeTags: ['politico', 'groove'],
  },
  {
    username: 'giulia.rossi',
    releaseKey: 'random-access-memories',
    rating: 70,
    content: 'Touch è un piccolo musical. Il resto è puro artigianato disco.',
    vibeTags: ['ballabile'],
  },
  {
    username: 'marco_beats',
    releaseKey: 'random-access-memories',
    rating: 50,
    content: 'Suona benissimo ma mi manca il sudore dei loro primi dischi.',
    vibeTags: ['patinato'],
  },
  {
    username: 'sara.vinyl',
    releaseKey: 'hai-paura-del-buio',
    rating: 100,
    content: 'Il disco che ha definito il rock alternativo italiano. Ancora feroce.',
    vibeTags: ['rabbioso', 'anni90'],
  },
  {
    username: 'francospagnati',
    releaseKey: 'titanic-rising',
    rating: 90,
    content: 'Andromeda è una ballata cosmica fuori dal tempo.',
    vibeTags: ['sognante', 'orchestrale'],
  },
  {
    username: 'rumorebianco',
    releaseKey: 'in-rainbows',
    rating: 90,
    content: 'Una band che rinuncia all’ansia e trova la grazia. Il loro lavoro più umano.',
    vibeTags: ['essenziale'],
    outletUrl: 'https://rumorebianco.example/recensioni/radiohead-in-rainbows',
  },
  {
    username: 'rumorebianco',
    releaseKey: 'to-pimp-a-butterfly',
    rating: 100,
    content: 'Un’opera densa e stratificata che ridefinisce il rap come forma d’arte totale.',
    vibeTags: ['capolavoro'],
    outletUrl: 'https://rumorebianco.example/recensioni/kendrick-lamar-tpab',
  },
  {
    username: 'rumorebianco',
    releaseKey: 'random-access-memories',
    rating: 70,
    content: 'Omaggio sontuoso e a tratti museale alla disco di fine anni 70.',
    vibeTags: ['retro'],
    outletUrl: 'https://rumorebianco.example/recensioni/daft-punk-ram',
  },
  {
    // Same person reviewing two editions: the group score counts her once (ADR-012).
    username: 'giulia.rossi',
    releaseKey: 'random-access-memories-10th',
    rating: 90,
    content: 'Gli outtake mostrano il cantiere: Horizon Ocean Drive vale da sola la ristampa.',
    vibeTags: ['ballabile', 'archivio'],
  },
  {
    username: 'sara.vinyl',
    releaseKey: 'random-access-memories-10th',
    rating: 80,
    content: 'Ristampa curata, i demo aggiungono contesto senza appesantire.',
    vibeTags: ['retro'],
  },
];

/** [reactor, reviewAuthor, releaseKey, type] */
const REACTIONS: Array<[string, string, string, ReactionType]> = [
  ['giulia.rossi', 'francospagnati', 'in-rainbows', ReactionType.AGREE],
  ['marco_beats', 'francospagnati', 'in-rainbows', ReactionType.WELL_WRITTEN],
  ['francospagnati', 'giulia.rossi', 'blonde', ReactionType.DISCOVERED],
  ['francospagnati', 'marco_beats', 'to-pimp-a-butterfly', ReactionType.HEART],
  ['sara.vinyl', 'rumorebianco', 'in-rainbows', ReactionType.WELL_WRITTEN],
];

interface SeedPlaylist {
  key: string;
  username: string;
  title: string;
  description: string;
  sides: { A: Array<[string, string]>; B: Array<[string, string]> };
}

const PLAYLISTS: SeedPlaylist[] = [
  {
    key: 'notturni',
    username: 'francospagnati',
    title: 'Notturni',
    description: 'Per guidare di notte con i finestrini abbassati.',
    sides: {
      A: [
        ['in-rainbows', 'Weird Fishes/Arpeggi'],
        ['blonde', 'Nights'],
        ['titanic-rising', 'Andromeda'],
      ],
      B: [
        ['in-rainbows', 'Videotape'],
        ['random-access-memories', 'Touch'],
      ],
    },
  },
  {
    key: 'campionature',
    username: 'marco_beats',
    title: 'Campionature',
    description: 'Groove da cui rubare.',
    sides: {
      A: [
        ['to-pimp-a-butterfly', 'King Kunta'],
        ['random-access-memories', 'Get Lucky'],
      ],
      B: [['to-pimp-a-butterfly', 'Alright']],
    },
  },
];

/** [key, sender, receiver, content, sharedTrack?, hoursAgo] */
const CHAT: Array<[string, string, string, string | null, [string, string] | null, number]> = [
  [
    'c1',
    'giulia.rossi',
    'francospagnati',
    'Ascolta questa, ti ricorda qualcosa?',
    ['blonde', 'Ivy'],
    30,
  ],
  ['c2', 'francospagnati', 'giulia.rossi', 'Pazzesca. Il finale mi ha steso.', null, 29],
  ['c3', 'marco_beats', 'francospagnati', null, ['to-pimp-a-butterfly', 'King Kunta'], 5],
  ['c4', 'francospagnati', 'marco_beats', 'Il basso di questo pezzo è illegale.', null, 4],
];

/** [key, author, content, releaseKey | null, rating | null, vibeTags, hoursAgo, likedBy] */
const POSTS: Array<
  [string, string, string, string | null, number | null, string[], number, string[]]
> = [
  [
    'p1',
    'giulia.rossi',
    'Weird Fishes/Arpeggi resta una delle composizioni più ipnotiche mai registrate: tre chitarre pulite che si rincorrono e una batteria che non sbaglia un colpo.',
    'in-rainbows',
    100,
    ['CapolavoroAssoluto'],
    1,
    ['francospagnati', 'marco_beats'],
  ],
  [
    'p2',
    'marco_beats',
    'Random Access Memories in cuffia, volume alto: i bassi suonati dal vivo hanno una dinamica che nessun plugin replica.',
    'random-access-memories',
    90,
    ['SuonoAnalogico'],
    3,
    ['francospagnati'],
  ],
  [
    'p3',
    'francospagnati',
    'Stasera si ascolta Blonde dall’inizio alla fine, niente shuffle. Chi si unisce?',
    'blonde',
    null,
    [],
    6,
    ['giulia.rossi', 'sara.vinyl'],
  ],
  [
    'p4',
    'rumorebianco',
    'Nuova recensione in arrivo: Titanic Rising, dieci anni di un disco che guarda al soft rock senza nostalgia.',
    'titanic-rising',
    null,
    ['Recensione'],
    20,
    [],
  ],
];

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
const LEGACY_RELEASE_IDS = ['rel_in_rainbows', 'rel_ram', 'rel_tpab'];

async function seedUsers(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  const passwordHash = hashDevPassword(DEV_PASSWORD);
  for (const u of USERS) {
    const data = {
      passwordHash,
      displayName: u.displayName,
      email: `${u.username.replace(/[^a-z0-9]/gi, '')}@openmusic.test`,
      avatarUrl: u.avatarUrl,
      bio: u.bio,
      role: u.role ?? Role.USER,
      isGhostMode: u.isGhostMode ?? false,
      criticOutlet: u.criticOutlet ?? null,
      criticVerifiedAt: u.role === Role.CRITIC ? new Date('2026-01-15T10:00:00Z') : null,
    };
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: data,
      create: { id: seedId(`user:${u.username}`), username: u.username, ...data },
    });
    ids.set(u.username, user.id);
  }
  return ids;
}

async function seedCatalog(): Promise<void> {
  // The first version of this seed used non-UUID ids and duplicated tracks on every run.
  await prisma.release.deleteMany({ where: { id: { in: LEGACY_RELEASE_IDS } } });

  for (const g of GROUPS) {
    const id = seedId(`group:${g.key}`);
    const data = {
      title: g.title,
      artistName: g.artistName,
      firstReleaseYear: g.firstReleaseYear,
      matchKey: g.matchKey,
    };
    await prisma.releaseGroup.upsert({ where: { id }, update: data, create: { id, ...data } });
  }

  for (const [ri, r] of RELEASES.entries()) {
    const releaseId = seedId(`release:${r.key}`);
    const data = {
      title: r.title,
      artistName: r.artistName,
      releaseType: r.releaseType,
      coverUrl: r.coverUrl,
      dominantColor: r.dominantColor,
      genres: r.genres,
      releaseDate: new Date(r.releaseDate),
      releaseGroupId: seedId(`group:${r.groupKey}`),
      editionLabel: r.edition?.label ?? null,
      format: r.edition?.format ?? null,
      country: r.edition?.country ?? null,
      ...(r.edition ? { label: r.edition.recordLabel } : {}),
    };
    await prisma.release.upsert({
      where: { id: releaseId },
      update: data,
      create: { id: releaseId, ...data },
    });

    for (const [ti, t] of r.tracks.entries()) {
      const isrc = isrcFor(ri, ti);
      const trackData = {
        title: t.title,
        artistName: r.artistName,
        durationMs: t.durationMs,
        releaseId,
      };
      await prisma.track.upsert({
        where: { isrc },
        update: trackData,
        create: { id: trackId(r.key, t.title), isrc, ...trackData },
      });
    }
  }

  // Databases migrated before this seed knew about groups got one backfilled group per release
  // (ADR-012 migration); the seed rows now point at their own groups, so drop the empty ones.
  await prisma.releaseGroup.deleteMany({ where: { releases: { none: {} } } });
}

async function seedSocial(userIds: Map<string, string>): Promise<void> {
  const uid = (username: string): string => {
    const id = userIds.get(username);
    if (!id) throw new Error(`Unknown seed user: ${username}`);
    return id;
  };

  for (const [follower, following] of FOLLOWS) {
    const key = { followerId: uid(follower), followingId: uid(following) };
    await prisma.follows.upsert({
      where: { followerId_followingId: key },
      update: {},
      create: key,
    });
  }

  for (const [username, releaseKey, title, days] of SCROBBLES) {
    const id = seedId(`scrobble:${username}:${releaseKey}:${title}`);
    const data = {
      userId: uid(username),
      trackId: trackId(releaseKey, title),
      releaseId: seedId(`release:${releaseKey}`),
      provider: 'SPOTIFY',
      playedAt: daysAgo(days, 2),
    };
    await prisma.scrobbleLog.upsert({ where: { id }, update: data, create: { id, ...data } });
  }

  // ADR-002 (same rule as ReviewsService): >= 3 distinct scrobbled tracks of the release, or all
  // of them for releases shorter than that.
  const distinctPlays = new Map<string, Set<string>>();
  for (const [u, rk, title] of SCROBBLES) {
    const k = `${u}:${rk}`;
    distinctPlays.set(k, (distinctPlays.get(k) ?? new Set()).add(title));
  }
  const verified = new Set(
    [...distinctPlays.entries()]
      .filter(([k, titles]) => {
        const releaseKey = k.slice(k.indexOf(':') + 1);
        const trackCount = RELEASES.find((r) => r.key === releaseKey)?.tracks.length ?? 0;
        return titles.size >= Math.max(1, Math.min(3, trackCount));
      })
      .map(([k]) => k)
  );
  for (const r of REVIEWS) {
    const userId = uid(r.username);
    const releaseId = seedId(`release:${r.releaseKey}`);
    const isCritic = USERS.find((u) => u.username === r.username)?.role === Role.CRITIC;
    const data: Omit<Prisma.ReviewUncheckedCreateInput, 'id' | 'userId' | 'releaseId'> = {
      rating: r.rating,
      content: r.content,
      vibeTags: r.vibeTags,
      isCritic,
      isVerifiedListen: verified.has(`${r.username}:${r.releaseKey}`),
      outletName: isCritic
        ? (USERS.find((u) => u.username === r.username)?.criticOutlet ?? null)
        : null,
      originalReviewUrl: r.outletUrl ?? null,
    };
    await prisma.review.upsert({
      where: { userId_releaseId: { userId, releaseId } },
      update: data,
      create: { id: seedId(`review:${r.username}:${r.releaseKey}`), userId, releaseId, ...data },
    });
  }

  for (const [reactor, author, releaseKey, type] of REACTIONS) {
    const review = await prisma.review.findUniqueOrThrow({
      where: {
        userId_releaseId: { userId: uid(author), releaseId: seedId(`release:${releaseKey}`) },
      },
      select: { id: true },
    });
    const key = { reviewId: review.id, userId: uid(reactor), type };
    await prisma.reviewReaction.upsert({
      where: { reviewId_userId_type: key },
      update: {},
      create: key,
    });
  }

  for (const p of PLAYLISTS) {
    const playlistId = seedId(`playlist:${p.key}`);
    const data = { userId: uid(p.username), title: p.title, description: p.description };
    await prisma.playlist.upsert({
      where: { id: playlistId },
      update: data,
      create: { id: playlistId, ...data },
    });
    for (const side of ['A', 'B'] as const) {
      for (const [position, [releaseKey, title]] of p.sides[side].entries()) {
        const tId = trackId(releaseKey, title);
        await prisma.playlistTrack.upsert({
          where: { playlistId_trackId: { playlistId, trackId: tId } },
          update: { side, position },
          create: { playlistId, trackId: tId, side, position },
        });
      }
    }
  }

  for (const [key, sender, receiver, content, shared, hours] of CHAT) {
    const id = seedId(`chat:${key}`);
    const data = {
      senderId: uid(sender),
      receiverId: uid(receiver),
      content,
      trackId: shared ? trackId(shared[0], shared[1]) : null,
      createdAt: daysAgo(0, hours),
    };
    await prisma.chatMessage.upsert({ where: { id }, update: data, create: { id, ...data } });
  }
}

async function seedPosts(userIds: Map<string, string>): Promise<void> {
  const uid = (username: string): string => {
    const id = userIds.get(username);
    if (!id) throw new Error(`Unknown seed user: ${username}`);
    return id;
  };
  for (const [key, author, content, releaseKey, rating, vibeTags, hours, likedBy] of POSTS) {
    const id = seedId(`post:${key}`);
    const authorId = uid(author);
    const data = {
      authorId,
      content,
      releaseId: releaseKey ? seedId(`release:${releaseKey}`) : null,
      rating,
      vibeTags,
      createdAt: daysAgo(0, hours),
    };
    await prisma.post.upsert({ where: { id }, update: data, create: { id, ...data } });
    for (const liker of likedBy) {
      const like = { postId: id, userId: uid(liker) };
      await prisma.postLike.upsert({
        where: { postId_userId: like },
        update: {},
        create: like,
      });
      const notificationId = seedId(`notification:like:${key}:${liker}`);
      const notification = {
        recipientId: authorId,
        actorId: like.userId,
        type: NotificationType.POST_LIKE,
        postId: id,
      };
      await prisma.notification.upsert({
        where: { id: notificationId },
        update: notification,
        create: { id: notificationId, ...notification },
      });
    }
  }

  for (const [follower, following] of FOLLOWS) {
    const notificationId = seedId(`notification:follow:${follower}:${following}`);
    const notification = {
      recipientId: uid(following),
      actorId: uid(follower),
      type: NotificationType.FOLLOW,
    };
    await prisma.notification.upsert({
      where: { id: notificationId },
      update: notification,
      create: { id: notificationId, ...notification },
    });
  }
}

interface Aggregate {
  avg: number | null;
  freshPct: number | null;
  count: number;
}

/**
 * ADR-001/ADR-002, mirrors apps/api/src/modules/reviews/score.ts: weighted average on the
 * 0.5–5.0 scale (1 decimal) and weighted % of ratings >= 70 ("fresh"); a verified listen
 * weighs 1.5x. Critic aggregates pass `weighted = false`.
 */
function aggregate(
  reviews: Array<{ rating: number; isVerifiedListen: boolean }>,
  weighted: boolean
): Aggregate {
  if (reviews.length === 0) return { avg: null, freshPct: null, count: 0 };
  let weightSum = 0;
  let ratingSum = 0;
  let freshSum = 0;
  for (const r of reviews) {
    const w = weighted && r.isVerifiedListen ? 1.5 : 1;
    weightSum += w;
    ratingSum += w * r.rating;
    if (r.rating >= 70) freshSum += w;
  }
  return {
    avg: Math.round((ratingSum / weightSum / 20) * 10) / 10,
    freshPct: Math.round((freshSum / weightSum) * 100),
    count: reviews.length,
  };
}

async function recomputeReleaseScores(): Promise<void> {
  const releases = await prisma.release.findMany({
    select: {
      id: true,
      reviews: { select: { rating: true, isCritic: true, isVerifiedListen: true } },
    },
  });
  for (const r of releases) {
    const audience = aggregate(
      r.reviews.filter((x) => !x.isCritic),
      true
    );
    const critic = aggregate(
      r.reviews.filter((x) => x.isCritic),
      false
    );
    await prisma.release.update({
      where: { id: r.id },
      data: {
        audienceAvg: audience.avg,
        audienceFreshPct: audience.freshPct,
        audienceCount: audience.count,
        criticAvg: critic.avg,
        criticFreshPct: critic.freshPct,
        criticCount: critic.count,
      },
    });
  }
}

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run the development seed with NODE_ENV=production');
  }
  console.log('Seeding OpenMusic database...');
  const userIds = await seedUsers();
  await seedCatalog();
  await seedSocial(userIds);
  await seedPosts(userIds);
  await recomputeReleaseScores();

  const counts = {
    users: await prisma.user.count(),
    releases: await prisma.release.count(),
    releaseGroups: await prisma.releaseGroup.count(),
    tracks: await prisma.track.count(),
    reviews: await prisma.review.count(),
    playlists: await prisma.playlist.count(),
    chatMessages: await prisma.chatMessage.count(),
    posts: await prisma.post.count(),
    notifications: await prisma.notification.count(),
  };
  console.log('Seed complete:', counts);
  console.log(
    `Sign in with any seeded email (e.g. francospagnati@openmusic.test, admin@openmusic.test) and password "${DEV_PASSWORD}".`
  );
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
