'use client';

import React from 'react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { Plus, Disc, Waveform } from '@phosphor-icons/react';

interface FriendStory {
  id: string;
  name: string;
  avatar: string;
  isPlaying: boolean;
  trackTitle: string;
  artist: string;
  albumCover: string;
  previewUrl: string;
}

const FRIEND_STORIES: FriendStory[] = [
  {
    id: 'st_1',
    name: 'Elena',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop',
    isPlaying: true,
    trackTitle: 'Weird Fishes/Arpeggi',
    artist: 'Radiohead',
    albumCover: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=100&h=100&fit=crop',
    previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
  },
  {
    id: 'st_2',
    name: 'Marco',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop',
    isPlaying: true,
    trackTitle: 'Get Lucky',
    artist: 'Daft Punk',
    albumCover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&h=100&fit=crop',
    previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
  },
  {
    id: 'st_3',
    name: 'Sofia',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop',
    isPlaying: true,
    trackTitle: 'King Kunta',
    artist: 'Kendrick Lamar',
    albumCover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100&h=100&fit=crop',
    previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
  },
  {
    id: 'st_4',
    name: 'Luca',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop',
    isPlaying: true,
    trackTitle: 'Do I Wanna Know?',
    artist: 'Arctic Monkeys',
    albumCover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&h=100&fit=crop',
    previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
  },
  {
    id: 'st_5',
    name: 'Giulia',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&h=120&fit=crop',
    isPlaying: true,
    trackTitle: 'Time',
    artist: 'Pink Floyd',
    albumCover: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=100&h=100&fit=crop',
    previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
  },
  {
    id: 'st_6',
    name: 'Matteo',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&h=120&fit=crop',
    isPlaying: false,
    trackTitle: 'CHIHIRO',
    artist: 'Billie Eilish',
    albumCover: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=100&h=100&fit=crop',
    previewUrl: 'https://cdns-preview-d.dzcdn.net/stream/c-deda7fa9316d9aa5228ec522267d7705-8.mp3',
  },
];

export const StoriesListeningBar: React.FC = () => {
  const { playTrack, currentTrack, isPlaying } = useAudioPlayer();

  return (
    <div className="w-full border-b border-om-border bg-om-card/40 py-3.5 px-4 overflow-hidden">
      <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-0.5">
        {/* Your Story / Connect bubble */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group">
          <div className="relative h-14 w-14 rounded-full border-2 border-dashed border-om-amber flex items-center justify-center bg-om-card group-hover:scale-105 transition-transform">
            <Plus weight="bold" className="h-5 w-5 text-om-amber" />
          </div>
          <span className="text-[11px] font-sans font-medium text-om-secondary group-hover:text-om-text">
            Il tuo ascolto
          </span>
        </div>

        {/* Friends Stories */}
        {FRIEND_STORIES.map((friend) => {
          const isThisPlaying = currentTrack?.id === friend.id && isPlaying;

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
              className="flex flex-col items-center gap-1.5 flex-shrink-0 cursor-pointer group"
              title={`${friend.name} sta ascoltando ${friend.trackTitle} - ${friend.artist}`}
            >
              <div className="relative">
                {/* Outer animated vinyl border */}
                <div
                  className={`h-14 w-14 rounded-full p-[2px] transition-all duration-300 group-hover:scale-105 ${
                    isThisPlaying
                      ? 'bg-gradient-to-tr from-om-amber via-yellow-500 to-om-fresh animate-[spin_6s_linear_infinite]'
                      : friend.isPlaying
                      ? 'bg-gradient-to-tr from-om-amber to-om-fresh'
                      : 'bg-om-border'
                  }`}
                >
                  <img
                    src={friend.avatar}
                    alt={friend.name}
                    className="h-full w-full rounded-full object-cover border-2 border-om-bg"
                  />
                </div>

                {/* Mini album cover badge */}
                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border border-om-border overflow-hidden bg-om-bg shadow-sm">
                  <img
                    src={friend.albumCover}
                    alt={friend.trackTitle}
                    className="h-full w-full object-cover"
                  />
                </div>

                {isThisPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full">
                    <Waveform weight="bold" className="h-5 w-5 text-om-amber animate-pulse" />
                  </div>
                )}
              </div>

              <span className="text-[11px] font-sans font-medium text-om-secondary group-hover:text-om-text truncate max-w-[60px]">
                {friend.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
