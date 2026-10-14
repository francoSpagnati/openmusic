'use client';

import React, { useState } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { RightSidebar } from '../../components/RightSidebar';
import { useAudioPlayer } from '../../context/AudioPlayerContext';
import {
  Play,
  Pause,
  Heart,
  ChatCircle,
  ShareNetwork,
  BookmarkSimple,
  ArrowDown,
  ArrowUp,
  Waveform,
  Disc,
  Star,
} from '@phosphor-icons/react';

interface MusicReel {
  id: string;
  title: string;
  artist: string;
  album: string;
  year: number;
  genre: string;
  coverUrl: string;
  previewUrl: string;
  criticScore: number;
  curatorNote: string;
  likesCount: number;
  commentsCount: number;
}

const REELS_DATA: MusicReel[] = [
  {
    id: 'reel_1',
    title: 'Weird Fishes/Arpeggi',
    artist: 'Radiohead',
    album: 'In Rainbows',
    year: 2007,
    genre: 'Art Rock',
    coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=800&h=800&fit=crop',
    previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
    criticScore: 94,
    curatorNote: 'Il crescendo poliritmico con tre chitarre che si rincorrono in arpeggi ipnotici.',
    likesCount: 1420,
    commentsCount: 184,
  },
  {
    id: 'reel_2',
    title: 'Get Lucky (feat. Pharrell Williams)',
    artist: 'Daft Punk',
    album: 'Random Access Memories',
    year: 2013,
    genre: 'Nu-Disco / Funk',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800&h=800&fit=crop',
    previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
    criticScore: 91,
    curatorNote: 'Il tocco inconfondibile della Stratocaster di Nile Rodgers e il groove basso analogico.',
    likesCount: 2310,
    commentsCount: 312,
  },
  {
    id: 'reel_3',
    title: 'King Kunta',
    artist: 'Kendrick Lamar',
    album: 'To Pimp a Butterfly',
    year: 2015,
    genre: 'West Coast Funk / Hip-Hop',
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&h=800&fit=crop',
    previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
    criticScore: 96,
    curatorNote: 'La linea di basso di Thundercat che trascina una dichiarazione politica e culturale monumentale.',
    likesCount: 3890,
    commentsCount: 520,
  },
  {
    id: 'reel_4',
    title: 'Time',
    artist: 'Pink Floyd',
    album: 'The Dark Side of the Moon',
    year: 1973,
    genre: 'Progressive Rock',
    coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=800&h=800&fit=crop',
    previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
    criticScore: 98,
    curatorNote: 'Dai rintocchi degli orologi fino all’assolo di David Gilmour con il pedale Fuzz Face.',
    likesCount: 5410,
    commentsCount: 780,
  },
  {
    id: 'reel_5',
    title: 'Plastic Love',
    artist: 'Mariya Takeuchi',
    album: 'Variety',
    year: 1984,
    genre: 'Japanese City Pop',
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=800&h=800&fit=crop',
    previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
    criticScore: 95,
    curatorNote: 'L’arrangiamento scintillante di Tatsuro Yamashita che ha conquistato il mondo.',
    likesCount: 4120,
    commentsCount: 640,
  },
];

export default function ReelsPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedReels, setLikedReels] = useState<Record<string, boolean>>({});
  const { playTrack, currentTrack, isPlaying } = useAudioPlayer();

  const currentReel = REELS_DATA[currentIndex];
  const isThisPlaying = currentTrack?.id === currentReel.id && isPlaying;
  const isLiked = likedReels[currentReel.id];

  const handlePlayToggle = () => {
    playTrack({
      id: currentReel.id,
      title: currentReel.title,
      artist: currentReel.artist,
      coverUrl: currentReel.coverUrl,
      previewUrl: currentReel.previewUrl,
    });
  };

  const handleNext = () => {
    if (currentIndex < REELS_DATA.length - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      const next = REELS_DATA[nextIndex];
      playTrack({
        id: next.id,
        title: next.title,
        artist: next.artist,
        coverUrl: next.coverUrl,
        previewUrl: next.previewUrl,
      });
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      const prev = REELS_DATA[prevIndex];
      playTrack({
        id: prev.id,
        title: prev.title,
        artist: prev.artist,
        coverUrl: prev.coverUrl,
        previewUrl: prev.previewUrl,
      });
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl justify-center">
      {/* 1. Left Sidebar Navigation */}
      <Sidebar />

      {/* 2. Center Column: Reels Immersive Player */}
      <main className="w-full max-w-2xl flex-1 border-r border-om-border min-h-screen p-4 sm:p-6 flex flex-col justify-center items-center">
        {/* Navigation Indicator Header */}
        <div className="w-full flex items-center justify-between mb-3 text-xs font-mono text-om-secondary">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-om-amber animate-pulse" />
            <span className="font-bold text-om-text">Music Reels</span>
            <span>• Anteprime 30s Istantanee</span>
          </div>

          <span className="tabular-nums">
            {currentIndex + 1} di {REELS_DATA.length}
          </span>
        </div>

        {/* The Reel Card */}
        <div className="relative w-full max-w-md aspect-[3/4] sm:aspect-[4/5] rounded-3xl overflow-hidden border border-om-border bg-om-card shadow-2xl flex flex-col justify-between p-6">
          {/* Background Album Art with dark gradient overlay */}
          <div className="absolute inset-0 z-0">
            <img
              src={currentReel.coverUrl}
              alt={currentReel.title}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-om-bg via-om-bg/50 to-transparent" />
          </div>

          {/* Top Reel Badges */}
          <div className="relative z-10 flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-om-text bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
              {currentReel.genre}
            </span>

            <div className="flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 border border-white/10 text-om-fresh font-mono text-xs font-bold tabular-nums">
              <span>Critic {currentReel.criticScore}%</span>
            </div>
          </div>

          {/* Center Play Button Overlay */}
          <div className="relative z-10 flex justify-center items-center my-auto">
            <button
              onClick={handlePlayToggle}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-om-amber text-om-bg shadow-glow hover:scale-110 active:scale-95 transition-transform"
              aria-label={isThisPlaying ? 'Pausa' : 'Riproduci anteprima'}
            >
              {isThisPlaying ? (
                <Pause weight="fill" className="h-9 w-9" />
              ) : (
                <Play weight="fill" className="h-9 w-9 ml-1" />
              )}
            </button>
          </div>

          {/* Bottom Information & Action Bar */}
          <div className="relative z-10 space-y-3">
            <div>
              <h2 className="font-editorial text-2xl sm:text-3xl font-bold text-om-text leading-tight">
                {currentReel.title}
              </h2>
              <p className="text-sm font-sans text-om-secondary mt-0.5">
                {currentReel.artist} • {currentReel.album} ({currentReel.year})
              </p>
            </div>

            <p className="text-xs text-om-text/90 leading-relaxed italic bg-black/40 backdrop-blur-sm p-2.5 rounded-xl border border-white/5">
              "{currentReel.curatorNote}"
            </p>

            {/* Interaction Bar (Fitts's Law Thumb Zone) */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <div className="flex items-center gap-4">
                <button
                  onClick={() =>
                    setLikedReels((prev) => ({
                      ...prev,
                      [currentReel.id]: !prev[currentReel.id],
                    }))
                  }
                  className="flex items-center gap-1.5 text-xs font-mono text-om-text hover:text-om-rotten transition-colors"
                >
                  <Heart
                    weight={isLiked ? 'fill' : 'regular'}
                    size={22}
                    className={isLiked ? 'text-om-rotten' : 'text-om-text'}
                  />
                  <span className="tabular-nums">
                    {currentReel.likesCount + (isLiked ? 1 : 0)}
                  </span>
                </button>

                <button className="flex items-center gap-1.5 text-xs font-mono text-om-text hover:text-om-amber transition-colors">
                  <ChatCircle size={22} />
                  <span className="tabular-nums">{currentReel.commentsCount}</span>
                </button>

                <button
                  onClick={() => alert('Brano salvato nella tua collezione vinilica!')}
                  className="text-om-text hover:text-om-amber transition-colors"
                  title="Salva brano"
                >
                  <BookmarkSimple size={22} />
                </button>
              </div>

              {/* Vertical Reel Steppers */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrev}
                  disabled={currentIndex === 0}
                  className="p-2 rounded-full bg-black/60 hover:bg-om-amber hover:text-om-bg text-om-text disabled:opacity-30 transition-colors"
                  aria-label="Reel precedente"
                >
                  <ArrowUp size={16} weight="bold" />
                </button>
                <button
                  onClick={handleNext}
                  disabled={currentIndex === REELS_DATA.length - 1}
                  className="p-2 rounded-full bg-black/60 hover:bg-om-amber hover:text-om-bg text-om-text disabled:opacity-30 transition-colors"
                  aria-label="Prossimo reel"
                >
                  <ArrowDown size={16} weight="bold" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 3. Right Sidebar */}
      <RightSidebar />
    </div>
  );
}
