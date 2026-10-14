'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Sidebar } from '../../components/Sidebar';
import { RightSidebar } from '../../components/RightSidebar';
import { GenreRouletteInteractive } from '../../components/GenreRouletteInteractive';
import { ReleaseCard, ReleaseCardData } from '../../components/ReleaseCard';
import {
  Compass,
  MagnifyingGlass,
  Sparkle,
  Disc,
  ArrowRight,
  Waveform,
} from '@phosphor-icons/react';

const EXPLORE_GENRES = [
  'Tutti i Generi',
  'Art Rock',
  'Electronic',
  'Japanese City Pop',
  'Shoegaze',
  'Hip-Hop',
  'Post-Punk',
  'Prog Rock',
  'Ambient',
];

const DISCOVERY_RELEASES: ReleaseCardData[] = [
  {
    id: 'rel_in_rainbows',
    title: 'In Rainbows',
    artist: 'Radiohead',
    releaseYear: 2007,
    coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=500&h=500&fit=crop',
    genre: 'Art Rock',
    dominantColor: '#D97736',
    previewTrack: {
      id: 'trk_weird_fishes',
      title: 'Weird Fishes/Arpeggi',
      previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
    },
    criticScore: { freshPercentage: 94, totalReviews: 38, status: 'FRESH' },
    audienceScore: { freshPercentage: 97, totalReviews: 1420, status: 'FRESH' },
  },
  {
    id: 'rel_vespertine',
    title: 'Random Access Memories',
    artist: 'Daft Punk',
    releaseYear: 2013,
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=500&h=500&fit=crop',
    genre: 'Electronic',
    dominantColor: '#8E5A9E',
    previewTrack: {
      id: 'trk_get_lucky',
      title: 'Get Lucky',
      previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
    },
    criticScore: { freshPercentage: 91, totalReviews: 42, status: 'FRESH' },
    audienceScore: { freshPercentage: 95, totalReviews: 2180, status: 'FRESH' },
  },
  {
    id: 'rel_kendrick',
    title: 'To Pimp a Butterfly',
    artist: 'Kendrick Lamar',
    releaseYear: 2015,
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&h=500&fit=crop',
    genre: 'Hip-Hop',
    dominantColor: '#4E9F6E',
    previewTrack: {
      id: 'trk_king_kunta',
      title: 'King Kunta',
      previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
    },
    criticScore: { freshPercentage: 96, totalReviews: 48, status: 'FRESH' },
    audienceScore: { freshPercentage: 96, totalReviews: 3100, status: 'FRESH' },
  },
  {
    id: 'rel_pink_floyd',
    title: 'The Dark Side of the Moon',
    artist: 'Pink Floyd',
    releaseYear: 1973,
    coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=500&h=500&fit=crop',
    genre: 'Prog Rock',
    dominantColor: '#C85A4B',
    previewTrack: {
      id: 'trk_time',
      title: 'Time',
      previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
    },
    criticScore: { freshPercentage: 98, totalReviews: 55, status: 'FRESH' },
    audienceScore: { freshPercentage: 99, totalReviews: 5400, status: 'FRESH' },
  },
];

export default function ExplorePage() {
  const [selectedGenre, setSelectedGenre] = useState('Tutti i Generi');
  const [search, setSearch] = useState('');

  const filteredReleases = DISCOVERY_RELEASES.filter((r) => {
    const matchesGenre = selectedGenre === 'Tutti i Generi' || r.genre === selectedGenre;
    const matchesSearch =
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.artist.toLowerCase().includes(search.toLowerCase());
    return matchesGenre && matchesSearch;
  });

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl justify-center">
      {/* 1. Left Sidebar Navigation */}
      <Sidebar />

      {/* 2. Center Column: Explore Hub */}
      <main className="w-full max-w-2xl flex-1 border-r border-om-border min-h-screen p-4 sm:p-6 space-y-8">
        {/* Header */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono text-om-amber font-semibold uppercase tracking-wider">
            <Compass size={16} weight="duotone" />
            <span>Esplora Gusti & Territori Sonori</span>
          </div>

          <h1 className="font-editorial text-3xl sm:text-4xl font-bold text-om-text">
            Trova la tua Prossima Ossessione
          </h1>

          {/* Search bar */}
          <div className="relative">
            <MagnifyingGlass
              size={18}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-om-secondary"
            />
            <input
              type="text"
              placeholder="Cerca album, artisti o generi musicali..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-om-border bg-om-card pl-10 pr-4 py-2.5 text-xs text-om-text placeholder-om-secondary focus:border-om-amber focus:outline-none"
            />
          </div>
        </div>

        {/* Genre Pill Filters */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 border-b border-om-border">
          {EXPLORE_GENRES.map((g) => (
            <button
              key={g}
              onClick={() => setSelectedGenre(g)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-mono transition-all whitespace-nowrap ${
                selectedGenre === g
                  ? 'bg-om-amber text-om-bg font-bold shadow-glow'
                  : 'bg-om-card text-om-secondary hover:text-om-text border border-om-border'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Interactive Genre Roulette ("Fuori dalla Bolla") */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-editorial text-2xl font-bold text-om-text">
              Roulette dei Generi
            </h2>
            <span className="text-xs font-mono text-om-amber">Esci dalla tua bolla</span>
          </div>
          <GenreRouletteInteractive />
        </section>

        {/* Releases Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-editorial text-2xl font-bold text-om-text">
              Album Consigliati per Te
            </h2>
            <span className="text-xs font-mono text-om-secondary tabular-nums">
              {filteredReleases.length} dischi trovati
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {filteredReleases.map((release) => (
              <ReleaseCard key={release.id} release={release} />
            ))}
          </div>
        </section>
      </main>

      {/* 3. Right Sidebar */}
      <RightSidebar />
    </div>
  );
}
