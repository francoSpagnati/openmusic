'use client';

import React, { useState } from 'react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { Disc, Sparkle, Play, Pause, ArrowClockwise, MusicNotes } from '@phosphor-icons/react';

interface GenreOption {
  genre: string;
  tagline: string;
  color: string;
  starterPack: {
    id: string;
    title: string;
    artist: string;
    year: number;
    previewUrl: string;
    coverUrl: string;
  }[];
}

const GENRE_ROULETTE_DATABASE: GenreOption[] = [
  {
    genre: 'Japanese City Pop',
    tagline: 'Sonorità jazz-funk anni 80 con arrangiamenti lussuosi e synth sognanti di Tokyo.',
    color: '#D97736',
    starterPack: [
      {
        id: 'cp1',
        title: 'Plastic Love',
        artist: 'Mariya Takeuchi',
        year: 1984,
        previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
        coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=120&h=120&fit=crop',
      },
      {
        id: 'cp2',
        title: 'Mayonaka no Door (Stay With Me)',
        artist: 'Miki Matsubara',
        year: 1979,
        previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
        coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=120&h=120&fit=crop',
      },
      {
        id: 'cp3',
        title: '4:00 AM',
        artist: 'Taeko Onuki',
        year: 1978,
        previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
        coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=120&h=120&fit=crop',
      },
    ],
  },
  {
    genre: 'Shoegaze & Dream Pop',
    tagline: 'Muri di chitarre riverberate, fuzz avvolgente e voci eteree che sfidano la gravità.',
    color: '#8E5A9E',
    starterPack: [
      {
        id: 'sg1',
        title: 'Alison',
        artist: 'Slowdive',
        year: 1993,
        previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
        coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=120&h=120&fit=crop',
      },
      {
        id: 'sg2',
        title: 'When You Sleep',
        artist: 'My Bloody Valentine',
        year: 1991,
        previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
        coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=120&h=120&fit=crop',
      },
      {
        id: 'sg3',
        title: 'Cherry-coloured Funk',
        artist: 'Cocteau Twins',
        year: 1990,
        previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
        coverUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=120&h=120&fit=crop',
      },
    ],
  },
  {
    genre: 'Math Rock & Midwest Emo',
    tagline: 'Tempi dispari in 7/8, tapping di chitarra pulita e narrazione intima e nostalgica.',
    color: '#4E9F6E',
    starterPack: [
      {
        id: 'mr1',
        title: 'Never Meant',
        artist: 'American Football',
        year: 1999,
        previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
        coverUrl: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=120&h=120&fit=crop',
      },
      {
        id: 'mr2',
        title: 'Animals',
        artist: 'TTNG',
        year: 2008,
        previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
        coverUrl: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=120&h=120&fit=crop',
      },
      {
        id: 'mr3',
        title: 'Clever Girl',
        artist: 'No Drum and Bass in the Jazz Room',
        year: 2010,
        previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
        coverUrl: 'https://images.unsplash.com/photo-1520523839898-507125cd53c1?w=120&h=120&fit=crop',
      },
    ],
  },
];

export const GenreRouletteInteractive: React.FC = () => {
  const [selectedGenreIndex, setSelectedGenreIndex] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const { playTrack, currentTrack, isPlaying } = useAudioPlayer();

  const handleSpin = () => {
    if (isSpinning) return;
    setIsSpinning(true);

    // Realistic roulette spin duration
    setTimeout(() => {
      setSelectedGenreIndex((prev) => (prev + 1) % GENRE_ROULETTE_DATABASE.length);
      setIsSpinning(false);
    }, 1200);
  };

  const currentGenre = GENRE_ROULETTE_DATABASE[selectedGenreIndex];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-om-border bg-om-card p-6 sm:p-8 shadow-2xl">
      {/* Background glow */}
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full opacity-20 blur-3xl transition-colors duration-700"
        style={{ backgroundColor: currentGenre.color }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        {/* Left Column: Vinyl Interactive Wheel */}
        <div className="lg:col-span-5 flex flex-col items-center text-center">
          <div className="relative flex h-52 w-52 sm:h-64 sm:w-64 items-center justify-center">
            {/* Spinning Vinyl Record */}
            <div
              className={`relative h-full w-full rounded-full border-4 border-[#252529] bg-[#0c0c0e] shadow-2xl flex items-center justify-center transition-transform ${
                isSpinning ? 'animate-[spin_0.4s_linear_infinite]' : 'rotate-12'
              }`}
            >
              {/* Concentric vinyl grooves */}
              <div className="absolute inset-3 rounded-full border border-white/5" />
              <div className="absolute inset-8 rounded-full border border-white/5" />
              <div className="absolute inset-14 rounded-full border border-white/5" />
              <div className="absolute inset-20 rounded-full border border-white/5" />

              {/* Center Record Label */}
              <div
                className="flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-full border-2 border-white/20 p-2 shadow-inner"
                style={{ backgroundColor: currentGenre.color }}
              >
                <div className="h-4 w-4 rounded-full bg-[#121214] border border-white/40" />
              </div>
            </div>
          </div>

          {/* Spin Trigger Button */}
          <button
            onClick={handleSpin}
            disabled={isSpinning}
            className="mt-6 flex items-center gap-2.5 rounded-full bg-om-amber hover:bg-om-amber/90 text-om-bg font-sans text-sm font-semibold px-6 py-3 transition-all shadow-glow hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            <ArrowClockwise weight="bold" className={`h-4 w-4 ${isSpinning ? 'animate-spin' : ''}`} />
            <span>{isSpinning ? 'Gira la Roulette...' : 'Gira Fuori dalla Bolla'}</span>
          </button>
        </div>

        {/* Right Column: Genre Explanation & 3-Track Starter Pack */}
        <div className="lg:col-span-7 flex flex-col space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <Sparkle weight="duotone" className="h-5 w-5 text-om-amber" />
              <span className="text-xs font-mono uppercase tracking-widest text-om-amber font-semibold">
                Esplorazione Guidata
              </span>
            </div>
            <h3 className="font-editorial text-2xl sm:text-3xl font-bold text-om-text mt-1">
              {currentGenre.genre}
            </h3>
            <p className="text-sm text-om-secondary mt-1.5 leading-relaxed">
              {currentGenre.tagline}
            </p>
          </div>

          {/* Starter Pack Tracklist */}
          <div className="space-y-2 pt-2">
            <span className="text-xs font-mono text-om-muted uppercase tracking-wider">
              Starter Pack (3 Brani con Anteprima 30s):
            </span>

            {currentGenre.starterPack.map((track) => {
              const isThisTrackPlaying = currentTrack?.id === track.id && isPlaying;

              return (
                <div
                  key={track.id}
                  onClick={() =>
                    playTrack({
                      id: track.id,
                      title: track.title,
                      artist: track.artist,
                      coverUrl: track.coverUrl,
                      previewUrl: track.previewUrl,
                    })
                  }
                  className={`group flex items-center justify-between rounded-lg border p-2.5 sm:p-3 transition-all cursor-pointer ${
                    isThisTrackPlaying
                      ? 'border-om-amber bg-om-card shadow-sm'
                      : 'border-om-border bg-om-bg/80 hover:border-om-border/80 hover:bg-om-card'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={track.coverUrl}
                      alt={track.title}
                      className="h-10 w-10 rounded object-cover border border-om-border flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <h4 className="text-sm font-medium text-om-text truncate font-sans group-hover:text-om-amber transition-colors">
                        {track.title}
                      </h4>
                      <p className="text-xs text-om-secondary truncate">
                        {track.artist} • <span className="font-mono tabular-nums">{track.year}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-mono text-om-muted hidden sm:inline tabular-nums">
                      0:30
                    </span>
                    <button
                      className={`flex h-8 w-8 items-center justify-center rounded-full transition-transform group-hover:scale-105 ${
                        isThisTrackPlaying
                          ? 'bg-om-amber text-om-bg shadow-glow'
                          : 'bg-om-interactive text-om-secondary group-hover:bg-om-amber group-hover:text-om-bg'
                      }`}
                      aria-label="Riproduci anteprima"
                    >
                      {isThisTrackPlaying ? (
                        <Pause weight="fill" className="h-4 w-4" />
                      ) : (
                        <Play weight="fill" className="h-4 w-4 ml-0.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
