'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import {
  MagnifyingGlass,
  Waveform,
  UserPlus,
  Check,
  Disc,
  Play,
  Pause,
  Sparkle,
  ArrowRight,
} from '@phosphor-icons/react';

interface TrendingAlbum {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  year: number;
  previewUrl: string;
  discussCount: string;
}

const TRENDING_ALBUMS: TrendingAlbum[] = [
  {
    id: 'rel_in_rainbows',
    title: 'In Rainbows',
    artist: 'Radiohead',
    coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=120&h=120&fit=crop',
    year: 2007,
    previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
    discussCount: '1.4k ascolti oggi',
  },
  {
    id: 'rel_vespertine',
    title: 'Random Access Memories',
    artist: 'Daft Punk',
    coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=120&h=120&fit=crop',
    year: 2013,
    previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
    discussCount: '890 recensioni',
  },
  {
    id: 'rel_kendrick',
    title: 'To Pimp a Butterfly',
    artist: 'Kendrick Lamar',
    coverUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=120&h=120&fit=crop',
    year: 2015,
    previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
    discussCount: '2.1k in rotazione',
  },
  {
    id: 'rel_pink_floyd',
    title: 'The Dark Side of the Moon',
    artist: 'Pink Floyd',
    coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=120&h=120&fit=crop',
    year: 1973,
    previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
    discussCount: 'Classico eterno',
  },
];

const SUGGESTED_USERS = [
  {
    id: 'u1',
    name: 'Chiara Moretti',
    handle: '@chiara_vinyl',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
    musicAffinity: 'Fan di Radiohead e Slowdive',
  },
  {
    id: 'u2',
    name: 'Davide Riva',
    handle: '@davideriva',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    musicAffinity: 'Collezionista Vinili Jazz',
  },
  {
    id: 'u3',
    name: 'Sara Bellini',
    handle: '@sarabellini',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    musicAffinity: 'Ascolti verificati su Last.fm',
  },
];

export const RightSidebar: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [followedUsers, setFollowedUsers] = useState<Record<string, boolean>>({});
  const { playTrack, currentTrack, isPlaying } = useAudioPlayer();

  const toggleFollow = (userId: string) => {
    setFollowedUsers((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  return (
    <aside className="sticky top-0 h-screen w-80 flex-shrink-0 flex-col space-y-5 border-l border-om-border bg-om-bg p-4 overflow-y-auto no-scrollbar hidden xl:flex">
      {/* Search Bar */}
      <div className="relative">
        <MagnifyingGlass
          size={18}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-om-secondary"
        />
        <input
          type="text"
          placeholder="Cerca album, band o amici..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-full border border-om-border bg-om-card pl-10 pr-4 py-2.5 text-xs text-om-text placeholder-om-secondary focus:border-om-amber focus:outline-none font-sans"
        />
      </div>

      {/* Spotify Live Connect Widget */}
      <div className="rounded-xl border border-om-border bg-om-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1DB954] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#1DB954]" />
            </span>
            <span className="font-sans font-bold text-xs text-om-text">Spotify Live Sync</span>
          </div>
          <span className="text-[10px] font-mono text-[#1DB954] font-semibold bg-[#1DB954]/10 border border-[#1DB954]/30 px-1.5 py-0.5 rounded">
            Attivo
          </span>
        </div>

        <p className="text-xs text-om-secondary leading-relaxed">
          I tuoi amici vedono cosa stai ascoltando in streaming in tempo reale.
        </p>

        <div className="flex items-center justify-between rounded-lg bg-om-bg p-2.5 border border-om-border">
          <div className="flex items-center gap-2.5 min-w-0">
            <Waveform weight="bold" className="h-4 w-4 text-[#1DB954] animate-pulse flex-shrink-0" />
            <div className="min-w-0">
              <span className="text-xs font-semibold text-om-text truncate block">
                Weird Fishes — Radiohead
              </span>
              <span className="text-[10px] font-mono text-om-secondary">In ascolto ora</span>
            </div>
          </div>
        </div>
      </div>

      {/* Trending Albums (Dischi del momento con copertine vere) */}
      <div className="rounded-xl border border-om-border bg-om-card p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <h4 className="font-editorial text-base font-bold text-om-text">
            Dischi del Momento
          </h4>
          <Link href="/#releases" className="text-xs font-mono text-om-amber hover:underline">
            Tutti
          </Link>
        </div>

        <div className="space-y-3">
          {TRENDING_ALBUMS.map((album) => {
            const isThisPlaying = currentTrack?.id === album.id && isPlaying;

            return (
              <div
                key={album.id}
                onClick={() =>
                  playTrack({
                    id: album.id,
                    title: album.title,
                    artist: album.artist,
                    coverUrl: album.coverUrl,
                    previewUrl: album.previewUrl,
                  })
                }
                className="group flex items-center justify-between gap-3 cursor-pointer p-1.5 rounded-lg hover:bg-om-interactive transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative h-11 w-11 rounded-md overflow-hidden border border-om-border flex-shrink-0">
                    <img
                      src={album.coverUrl}
                      alt={album.title}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      {isThisPlaying ? (
                        <Pause weight="fill" className="h-4 w-4 text-om-amber" />
                      ) : (
                        <Play weight="fill" className="h-4 w-4 text-om-amber ml-0.5" />
                      )}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <h5 className="font-sans font-semibold text-xs text-om-text truncate group-hover:text-om-amber transition-colors">
                      {album.title}
                    </h5>
                    <p className="text-[11px] text-om-secondary truncate">
                      {album.artist} • <span className="font-mono tabular-nums">{album.year}</span>
                    </p>
                    <span className="text-[10px] font-mono text-om-muted">
                      {album.discussCount}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Suggested Users / Who to follow */}
      <div className="rounded-xl border border-om-border bg-om-card p-4 space-y-3.5">
        <h4 className="font-editorial text-base font-bold text-om-text">
          Chi Seguire
        </h4>

        <div className="space-y-3">
          {SUGGESTED_USERS.map((user) => {
            const isFollowed = followedUsers[user.id];

            return (
              <div key={user.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="h-9 w-9 rounded-full object-cover border border-om-border flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <h6 className="font-sans font-semibold text-xs text-om-text truncate">
                      {user.name}
                    </h6>
                    <p className="text-[10px] font-mono text-om-secondary truncate">
                      {user.handle}
                    </p>
                    <p className="text-[10px] text-om-muted truncate">
                      {user.musicAffinity}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => toggleFollow(user.id)}
                  className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-mono font-medium transition-all flex-shrink-0 ${
                    isFollowed
                      ? 'border border-om-border bg-om-bg text-om-secondary'
                      : 'bg-om-amber text-om-bg font-semibold hover:bg-om-amber/90'
                  }`}
                >
                  {isFollowed ? (
                    <>
                      <Check size={12} weight="bold" />
                      <span>Seguito</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={12} weight="bold" />
                      <span>Segui</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer micro links */}
      <div className="px-2 pt-2 text-[11px] text-om-muted font-sans flex flex-wrap gap-x-3 gap-y-1">
        <Link href="/critics" className="hover:underline">Critic Score</Link>
        <Link href="/videos" className="hover:underline">Video Saggi</Link>
        <a href="https://github.com/francoSpagnati/openmusic" target="_blank" rel="noreferrer" className="hover:underline">
          GitHub Open Source
        </a>
        <p>© {new Date().getFullYear()} OpenMusic</p>
      </div>
    </aside>
  );
};
