'use client';

import React from 'react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import {
  X,
  Play,
  Pause,
  Heart,
  Fire,
  ChatCircle,
  ShareNetwork,
  Disc,
  Waveform,
  CheckCircle,
} from '@phosphor-icons/react';

export interface FriendStoryData {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  isPlaying: boolean;
  trackTitle: string;
  artist: string;
  album: string;
  albumCover: string;
  year: number;
  progressMs: number;
  durationMs: number;
  previewUrl: string;
  provider: 'SPOTIFY' | 'APPLE_MUSIC' | 'LASTFM';
}

interface StoryListeningModalProps {
  friend: FriendStoryData | null;
  onClose: () => void;
}

export const StoryListeningModal: React.FC<StoryListeningModalProps> = ({ friend, onClose }) => {
  const { playTrack, currentTrack, isPlaying } = useAudioPlayer();

  if (!friend) return null;

  const isCurrentPlaying = currentTrack?.id === friend.id && isPlaying;

  const handlePlayToggle = () => {
    playTrack({
      id: friend.id,
      title: friend.trackTitle,
      artist: friend.artist,
      coverUrl: friend.albumCover,
      previewUrl: friend.previewUrl,
    });
  };

  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = (friend.progressMs / friend.durationMs) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      {/* Background click dismiss */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-om-border bg-om-card p-6 shadow-2xl z-10 space-y-6">
        {/* Header: Friend info & Close */}
        <div className="flex items-center justify-between border-b border-om-border pb-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={friend.avatar}
                alt={friend.name}
                className="h-11 w-11 rounded-full object-cover border-2 border-om-amber"
              />
              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-[#1DB954] border-2 border-om-card" />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-sans text-base font-bold text-om-text">
                  {friend.name}
                </h3>
                <span className="text-xs font-mono text-om-secondary">
                  {friend.handle}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-mono text-[#1DB954]">
                <Waveform weight="bold" className="h-3 w-3 animate-pulse" />
                <span>In ascolto ora su {friend.provider}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-full p-2 text-om-secondary hover:bg-om-interactive hover:text-om-text transition-colors"
            aria-label="Chiudi"
          >
            <X size={20} />
          </button>
        </div>

        {/* Album Artwork with Vinyl spinning animation */}
        <div className="relative flex justify-center py-2">
          <div className="relative aspect-square w-56 sm:w-64 rounded-xl overflow-hidden border border-om-border shadow-2xl group">
            <img
              src={friend.albumCover}
              alt={friend.trackTitle}
              className="h-full w-full object-cover"
            />

            {/* Vinyl Record Peeking Out */}
            <div
              className={`absolute -right-10 top-4 bottom-4 w-32 rounded-full bg-[#0d0d0f] border-2 border-white/10 shadow-2xl flex items-center justify-center transition-transform ${
                isCurrentPlaying ? 'animate-[spin_4s_linear_infinite]' : 'translate-x-4'
              }`}
            >
              <div className="h-10 w-10 rounded-full bg-om-amber border border-white/20 flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-om-bg" />
              </div>
            </div>

            {/* Central Play Trigger Button */}
            <button
              onClick={handlePlayToggle}
              className="absolute inset-0 bg-black/30 flex items-center justify-center hover:bg-black/40 transition-colors"
              aria-label={isCurrentPlaying ? 'Pausa' : 'Ascolta anteprima'}
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-om-amber text-om-bg shadow-glow hover:scale-110 active:scale-95 transition-transform">
                {isCurrentPlaying ? (
                  <Pause weight="fill" className="h-7 w-7" />
                ) : (
                  <Play weight="fill" className="h-7 w-7 ml-0.5" />
                )}
              </div>
            </button>
          </div>
        </div>

        {/* Track Title & Artist Info */}
        <div className="text-center space-y-1">
          <h4 className="font-editorial text-2xl font-bold text-om-text line-clamp-1">
            {friend.trackTitle}
          </h4>
          <p className="text-sm text-om-secondary font-sans">
            {friend.artist} • <span className="italic">{friend.album}</span> ({friend.year})
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5">
          <div className="h-1.5 w-full bg-om-interactive rounded-full overflow-hidden">
            <div
              className="h-full bg-om-amber rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between text-xs font-mono text-om-secondary tabular-nums">
            <span>{formatTime(friend.progressMs)}</span>
            <span>{formatTime(friend.durationMs)}</span>
          </div>
        </div>

        {/* Social Fast Reactions / Actions */}
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-om-border/50">
          <button
            onClick={() => alert(`Hai inviato una reazione 🔥 a ${friend.name}!`)}
            className="flex flex-col items-center gap-1 p-2 rounded-xl bg-om-bg hover:bg-om-interactive transition-colors text-xs font-mono text-om-text"
          >
            <Fire size={20} weight="fill" className="text-orange-500" />
            <span className="text-[10px]">Fuoco</span>
          </button>

          <button
            onClick={() => alert(`Hai salvato ${friend.trackTitle} nei tuoi preferiti!`)}
            className="flex flex-col items-center gap-1 p-2 rounded-xl bg-om-bg hover:bg-om-interactive transition-colors text-xs font-mono text-om-text"
          >
            <Heart size={20} weight="fill" className="text-red-500" />
            <span className="text-[10px]">Cuore</span>
          </button>

          <button
            onClick={handlePlayToggle}
            className="flex flex-col items-center gap-1 p-2 rounded-xl bg-om-bg hover:bg-om-interactive transition-colors text-xs font-mono text-om-text"
          >
            <Waveform size={20} weight="bold" className="text-om-amber" />
            <span className="text-[10px]">{isCurrentPlaying ? 'In Pausa' : 'Ascolta'}</span>
          </button>

          <button
            onClick={() => alert(`Apertura chat con ${friend.name} per consigliare un brano...`)}
            className="flex flex-col items-center gap-1 p-2 rounded-xl bg-om-bg hover:bg-om-interactive transition-colors text-xs font-mono text-om-text"
          >
            <ChatCircle size={20} weight="duotone" className="text-blue-400" />
            <span className="text-[10px]">Chatta</span>
          </button>
        </div>
      </div>
    </div>
  );
};
