import React from 'react';
import Link from 'next/link';
import { LiveFriendsTicker } from '../components/LiveFriendsTicker';
import { ReleaseCard, ReleaseCardData } from '../components/ReleaseCard';
import { GenreRouletteInteractive } from '../components/GenreRouletteInteractive';
import { SpotifyConnectCard } from '../components/SpotifyConnectCard';
import {
  Disc,
  SealCheck,
  UsersThree,
  DeviceMobile,
  ArrowRight,
  Waveform,
  Sparkle,
  Newspaper,
  ShieldCheck,
} from '@phosphor-icons/react/dist/ssr';

// Sample curated release catalog data
const FEATURED_RELEASES: ReleaseCardData[] = [
  {
    id: 'rel_in_rainbows',
    title: 'In Rainbows',
    artist: 'Radiohead',
    releaseYear: 2007,
    coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&h=500&fit=crop',
    genre: 'Art Rock / Electronic',
    dominantColor: '#D97736',
    previewTrack: {
      id: 'trk_weird_fishes',
      title: 'Weird Fishes/Arpeggi',
      previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
    },
    criticScore: {
      freshPercentage: 94,
      totalReviews: 38,
      status: 'FRESH',
    },
    audienceScore: {
      freshPercentage: 97,
      totalReviews: 1420,
      status: 'FRESH',
    },
  },
  {
    id: 'rel_vespertine',
    title: 'Vespertine',
    artist: 'Björk',
    releaseYear: 2001,
    coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&h=500&fit=crop',
    genre: 'Microhouse / Chamber Pop',
    dominantColor: '#8E5A9E',
    previewTrack: {
      id: 'trk_pagan_poetry',
      title: 'Pagan Poetry',
      previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
    },
    criticScore: {
      freshPercentage: 92,
      totalReviews: 24,
      status: 'FRESH',
    },
    audienceScore: {
      freshPercentage: 95,
      totalReviews: 890,
      status: 'FRESH',
    },
  },
  {
    id: 'rel_brat',
    title: 'BRAT',
    artist: 'Charli xcx',
    releaseYear: 2024,
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=500&h=500&fit=crop',
    genre: 'Hyperpop / Club',
    dominantColor: '#7BB33C',
    previewTrack: {
      id: 'trk_360',
      title: '360',
      previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
    },
    criticScore: {
      freshPercentage: 96,
      totalReviews: 45,
      status: 'FRESH',
    },
    audienceScore: {
      freshPercentage: 88,
      totalReviews: 2100,
      status: 'FRESH',
    },
  },
  {
    id: 'rel_plastic_beach',
    title: 'Plastic Beach',
    artist: 'Gorillaz',
    releaseYear: 2010,
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&h=500&fit=crop',
    genre: 'Electropop / Hip-Hop',
    dominantColor: '#C85A4B',
    previewTrack: {
      id: 'trk_on_melancholy_hill',
      title: 'On Melancholy Hill',
      previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
    },
    criticScore: {
      freshPercentage: 82,
      totalReviews: 31,
      status: 'FRESH',
    },
    audienceScore: {
      freshPercentage: 91,
      totalReviews: 1840,
      status: 'FRESH',
    },
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col space-y-16 sm:space-y-24">
      {/* Live Listening Presence Ticker */}
      <LiveFriendsTicker />

      {/* Hero Editorial Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 sm:pt-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-om-amber/40 bg-om-amber/10 px-3.5 py-1 text-xs font-mono text-om-amber">
              <Sparkle weight="duotone" className="h-4 w-4" />
              <span>Social Network Musicale Analogico & Open Source</span>
            </div>

            <h1 className="font-editorial text-4xl sm:text-6xl font-bold tracking-tight text-om-text leading-[1.1]">
              La musica non è un algoritmo.{' '}
              <span className="text-om-amber italic font-normal">È un rito condiviso.</span>
            </h1>

            <p className="text-base sm:text-lg text-om-secondary leading-relaxed max-w-2xl">
              Niente feed infiniti di dipendenza. Scopri cosa stanno ascoltando i tuoi amici in tempo
              reale, leggi recensioni a doppio punteggio (giornalisti accreditati vs ascolti verificati)
              e ritrova il calore del vinile.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="#releases"
                className="flex items-center gap-2 rounded-lg bg-om-amber hover:bg-om-amber/90 text-om-bg font-sans font-semibold px-6 py-3.5 text-sm transition-all shadow-glow hover:scale-[1.02]"
              >
                <Disc weight="bold" className="h-5 w-5" />
                <span>Esplora Releases</span>
              </Link>

              <Link
                href="/critics"
                className="flex items-center gap-2 rounded-lg border border-om-border bg-om-card hover:bg-om-interactive text-om-text font-sans font-medium px-5 py-3.5 text-sm transition-colors"
              >
                <Newspaper weight="duotone" className="h-5 w-5 text-om-amber" />
                <span>Critic Score & Accrediti</span>
              </Link>
            </div>

            {/* Micro value props */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-om-border/60">
              <div>
                <span className="font-mono text-xl sm:text-2xl font-bold text-om-text tabular-nums">
                  100%
                </span>
                <p className="text-xs text-om-secondary mt-0.5">Open-Source & No AI-Slop</p>
              </div>
              <div>
                <span className="font-mono text-xl sm:text-2xl font-bold text-om-fresh tabular-nums">
                  Dual Score
                </span>
                <p className="text-xs text-om-secondary mt-0.5">Critica vs Pubblico</p>
              </div>
              <div>
                <span className="font-mono text-xl sm:text-2xl font-bold text-om-amber tabular-nums">
                  30s Audio
                </span>
                <p className="text-xs text-om-secondary mt-0.5">Anteprime via ISRC</p>
              </div>
            </div>
          </div>

          {/* Hero Right Visual: Analog Vinyl Art */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative aspect-square w-72 sm:w-96 rounded-2xl border border-om-border bg-om-card p-6 shadow-2xl overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-om-amber/15 via-transparent to-transparent opacity-50" />

              <div className="relative flex h-full w-full items-center justify-center">
                {/* Vinyl Record */}
                <div className="relative h-60 w-60 sm:h-72 sm:w-72 rounded-full bg-[#0d0d0f] border-4 border-[#222226] shadow-2xl flex items-center justify-center transition-transform group-hover:rotate-45 duration-700">
                  <div className="absolute inset-4 rounded-full border border-white/5" />
                  <div className="absolute inset-10 rounded-full border border-white/5" />
                  <div className="absolute inset-16 rounded-full border border-white/5" />
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-om-amber p-2 text-center shadow-inner">
                    <span className="font-editorial text-[10px] font-bold text-om-bg uppercase tracking-widest">
                      SIDE A • 33 RPM
                    </span>
                  </div>
                </div>

                {/* Overlaid Card preview */}
                <div className="absolute bottom-2 left-2 right-2 rounded-xl border border-om-border/80 bg-om-card/90 backdrop-blur-md p-3 shadow-analog">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Waveform weight="bold" className="h-4 w-4 text-om-amber animate-pulse" />
                      <span className="text-xs font-mono text-om-text">Now Playing • Marco V.</span>
                    </div>
                    <span className="text-[10px] font-mono text-om-fresh border border-om-fresh/30 bg-om-fresh/10 px-1.5 py-0.5 rounded">
                      Verificato
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-om-text font-sans truncate mt-1">
                    Radiohead — Weird Fishes/Arpeggi
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Releases Section */}
      <section id="releases" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 scroll-mt-20">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Disc weight="duotone" className="h-5 w-5 text-om-amber" />
              <span className="text-xs font-mono uppercase tracking-widest text-om-amber font-semibold">
                Classifica & Ultime Uscite
              </span>
            </div>
            <h2 className="font-editorial text-3xl font-bold text-om-text mt-1">
              Dual Score Rotten Tomatoes
            </h2>
            <p className="text-sm text-om-secondary mt-1">
              Confronta la percentuale di freschezza tra la critica accreditata e gli ascolti verificati.
            </p>
          </div>

          <Link
            href="/critics"
            className="flex items-center gap-1.5 text-xs font-mono text-om-amber hover:underline self-start sm:self-auto"
          >
            <span>Tutti i voti della critica</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURED_RELEASES.map((release) => (
            <ReleaseCard key={release.id} release={release} />
          ))}
        </div>
      </section>

      {/* Spotify Live Integration & Heavy Rotation Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SpotifyConnectCard />
      </section>

      {/* Interactive Genre Roulette Discovery Section */}
      <section id="roulette" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 scroll-mt-20">
        <div className="mb-6">
          <h2 className="font-editorial text-3xl font-bold text-om-text">
            Roulette dei Generi
          </h2>
          <p className="text-sm text-om-secondary mt-1">
            Algoritmo anti-bolla: fai girare il piatto e scopri territori sonori che i tuoi algoritmi
            soliti non ti mostrano mai.
          </p>
        </div>

        <GenreRouletteInteractive />
      </section>

      {/* Philosophy & Nielsen UX Section */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-om-border bg-om-card/60 p-8 sm:p-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-om-interactive border border-om-border text-om-amber">
                <SealCheck size={22} weight="duotone" />
              </div>
              <h3 className="font-editorial text-xl font-bold text-om-text">
                Critic Score Accreditato
              </h3>
              <p className="text-sm text-om-secondary leading-relaxed">
                Le recensioni dei giornalisti hanno un peso separato. Nessun voto anonimo comprato:
                solo firme editoriali verificate e link diretti agli articoli originali.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-om-interactive border border-om-border text-om-fresh">
                <UsersThree size={22} weight="duotone" />
              </div>
              <h3 className="font-editorial text-xl font-bold text-om-text">
                Ascolto Verificato
              </h3>
              <p className="text-sm text-om-secondary leading-relaxed">
                Gli utenti ottengono il badge di ascolto verificato solo scrobblando tramite Spotify o
                Last.fm. I voti del pubblico riflettono chi ha davvero ascoltato il disco.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-om-interactive border border-om-border text-om-amber">
                <ShieldCheck size={22} weight="duotone" />
              </div>
              <h3 className="font-editorial text-xl font-bold text-om-text">
                Ghost Mode & Rispetto UX
              </h3>
              <p className="text-sm text-om-secondary leading-relaxed">
                Euristica Nielsen #3: Libertà e controllo. Attiva la Ghost Mode con 1 tap quando vuoi
                ascoltare guilty pleasures senza comparire nei feed degli amici.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
