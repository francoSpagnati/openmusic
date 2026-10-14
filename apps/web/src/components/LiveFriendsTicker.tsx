'use client';

import React from 'react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { Waveform, EyeSlash, Play, SpeakerHigh } from '@phosphor-icons/react';

interface FriendActivity {
  id: string;
  name: string;
  avatar: string;
  trackTitle: string;
  artist: string;
  albumCover: string;
  previewUrl: string;
  isGhost: boolean;
  timeAgo: string;
}

const MOCK_FRIENDS: FriendActivity[] = [
  {
    id: 'f1',
    name: 'Elena Rossi',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
    trackTitle: 'Midnight City',
    artist: 'M83',
    albumCover: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&h=100&fit=crop',
    previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
    isGhost: false,
    timeAgo: 'ora',
  },
  {
    id: 'f2',
    name: 'Marco V.',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    trackTitle: 'Plastic Love',
    artist: 'Mariya Takeuchi',
    albumCover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop',
    previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
    isGhost: false,
    timeAgo: '1m fa',
  },
  {
    id: 'f3',
    name: 'Sofia B.',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    trackTitle: 'Lover, You Should Have Come Over',
    artist: 'Jeff Buckley',
    albumCover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&h=100&fit=crop',
    previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
    isGhost: false,
    timeAgo: 'ora',
  },
  {
    id: 'f4',
    name: 'Luca G.',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
    trackTitle: 'Ghost Mode Attiva',
    artist: 'Nessun broadcast pubblico',
    albumCover: '',
    previewUrl: '',
    isGhost: true,
    timeAgo: 'in incognito',
  },
];

export const LiveFriendsTicker: React.FC = () => {
  const { playTrack, currentTrack, isPlaying } = useAudioPlayer();

  return (
    <section className="w-full border-y border-om-border bg-om-card/50 py-3 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          {/* Label Header */}
          <div className="flex items-center gap-2 flex-shrink-0 pr-3 border-r border-om-border">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-om-amber opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-om-amber" />
            </span>
            <span className="text-xs font-mono uppercase tracking-wider text-om-secondary font-semibold hidden sm:inline">
              In Ascolto Ora
            </span>
          </div>

          {/* Scrolling / Flex friend bubbles */}
          <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto no-scrollbar py-1">
            {MOCK_FRIENDS.map((friend) => {
              const isThisPlaying = currentTrack?.id === friend.id && isPlaying;

              if (friend.isGhost) {
                return (
                  <div
                    key={friend.id}
                    className="flex items-center gap-2 rounded-full border border-dashed border-om-border bg-om-bg/50 px-3 py-1.5 flex-shrink-0 opacity-60"
                    title="Amico in Ghost Mode (Euristica Nielsen #3: Libertà e Controllo)"
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-om-interactive text-om-muted">
                      <EyeSlash size={14} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-om-muted">{friend.name}</span>
                      <span className="text-[10px] font-mono text-om-muted/80">Ghost Mode</span>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={friend.id}
                  onClick={() =>
                    playTrack({
                      id: friend.id,
                      title: friend.trackTitle,
                      artist: friend.artist,
                      coverUrl: friend.albumCover,
                      previewUrl: friend.previewUrl,
                    })
                  }
                  className={`group flex items-center gap-2.5 rounded-full border px-3 py-1.5 flex-shrink-0 cursor-pointer transition-all hover:border-om-amber hover:bg-om-card shadow-sm ${
                    isThisPlaying
                      ? 'border-om-amber bg-om-card'
                      : 'border-om-border bg-om-bg/80'
                  }`}
                >
                  {/* User Avatar + Equalizer */}
                  <div className="relative h-7 w-7 flex-shrink-0 overflow-hidden rounded-full border border-om-border">
                    <img
                      src={friend.avatar}
                      alt={friend.name}
                      className="h-full w-full object-cover"
                    />
                    {isThisPlaying && (
                      <div className="absolute inset-0 bg-om-amber/80 flex items-center justify-center">
                        <Waveform weight="bold" className="h-4 w-4 text-om-bg animate-pulse" />
                      </div>
                    )}
                  </div>

                  {/* Friend & Song details */}
                  <div className="flex flex-col min-w-0 pr-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-om-text truncate max-w-[100px] sm:max-w-[120px]">
                        {friend.name}
                      </span>
                      <span className="text-[10px] font-mono text-om-amber tabular-nums">
                        {friend.timeAgo}
                      </span>
                    </div>
                    <span className="text-[11px] text-om-secondary truncate max-w-[130px] sm:max-w-[160px]">
                      {friend.trackTitle} • {friend.artist}
                    </span>
                  </div>

                  {/* Quick play action */}
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-om-interactive group-hover:bg-om-amber group-hover:text-om-bg text-om-secondary transition-colors">
                    <Play weight="fill" className="h-2.5 w-2.5 ml-0.5" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
