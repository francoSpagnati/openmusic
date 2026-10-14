import { PrismaClient, Role, ReleaseType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding OpenMusic Database...');

  // 1. Create main user
  const userFranco = await prisma.user.upsert({
    where: { username: 'francospagnati' },
    update: {},
    create: {
      username: 'francospagnati',
      displayName: 'Franco Spagnati',
      email: 'franco@openmusic.social',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&h=160&fit=crop',
      bio: 'Appassionato di vinili, art-rock, psichedelia e produzioni analogiche. Ascolti scrobbati in tempo reale.',
      role: Role.USER,
      isGhostMode: false,
    },
  });

  // 2. Create accredited critic user
  const criticPitchfork = await prisma.user.upsert({
    where: { username: 'pitchfork_official' },
    update: {},
    create: {
      username: 'pitchfork_official',
      displayName: 'Pitchfork Reviews',
      email: 'reviews@pitchfork.com',
      avatarUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=160&h=160&fit=crop',
      bio: 'Firma editoriale accreditata OpenMusic. Voti e recensioni certificate da Pitchfork Media.',
      role: Role.CRITIC,
      criticOutlet: 'Pitchfork',
      criticVerifiedAt: new Date(),
    },
  });

  // 3. Create releases
  const inRainbows = await prisma.release.upsert({
    where: { id: 'rel_in_rainbows' },
    update: {},
    create: {
      id: 'rel_in_rainbows',
      title: 'In Rainbows',
      artistName: 'Radiohead',
      releaseType: ReleaseType.ALBUM,
      coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&h=600&fit=crop',
      dominantColor: '#D97736',
      genres: ['Art Rock', 'Alternative Rock', 'Electronic'],
      releaseDate: new Date('2007-10-10'),
      audienceAvg: 4.9,
      audienceFreshPct: 97,
      audienceCount: 1420,
      criticAvg: 4.8,
      criticFreshPct: 98,
      criticCount: 42,
    },
  });

  const ram = await prisma.release.upsert({
    where: { id: 'rel_ram' },
    update: {},
    create: {
      id: 'rel_ram',
      title: 'Random Access Memories',
      artistName: 'Daft Punk',
      releaseType: ReleaseType.ALBUM,
      coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&h=600&fit=crop',
      dominantColor: '#8E5A9E',
      genres: ['Disco', 'Funk', 'Electronic'],
      releaseDate: new Date('2013-05-17'),
      audienceAvg: 4.6,
      audienceFreshPct: 92,
      audienceCount: 980,
      criticAvg: 4.5,
      criticFreshPct: 88,
      criticCount: 38,
    },
  });

  const tpab = await prisma.release.upsert({
    where: { id: 'rel_tpab' },
    update: {},
    create: {
      id: 'rel_tpab',
      title: 'To Pimp a Butterfly',
      artistName: 'Kendrick Lamar',
      releaseType: ReleaseType.ALBUM,
      coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&h=600&fit=crop',
      dominantColor: '#2B2B2B',
      genres: ['Hip-Hop', 'Jazz Rap', 'Funk'],
      releaseDate: new Date('2015-03-15'),
      audienceAvg: 4.9,
      audienceFreshPct: 96,
      audienceCount: 2100,
      criticAvg: 4.9,
      criticFreshPct: 97,
      criticCount: 50,
    },
  });

  // 4. Create tracks
  await prisma.track.createMany({
    data: [
      {
        releaseId: inRainbows.id,
        title: '15 Step',
        artistName: 'Radiohead',
        durationMs: 237000,
        previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
      },
      {
        releaseId: inRainbows.id,
        title: 'Bodysnatchers',
        artistName: 'Radiohead',
        durationMs: 242000,
        previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
      },
      {
        releaseId: inRainbows.id,
        title: 'Weird Fishes/Arpeggi',
        artistName: 'Radiohead',
        durationMs: 318000,
        previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
      },
      {
        releaseId: inRainbows.id,
        title: 'Reckoner',
        artistName: 'Radiohead',
        durationMs: 290000,
        previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
      },
      {
        releaseId: inRainbows.id,
        title: 'Videotape',
        artistName: 'Radiohead',
        durationMs: 279000,
        previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
      },
    ],
    skipDuplicates: true,
  });

  console.log('✅ OpenMusic Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
