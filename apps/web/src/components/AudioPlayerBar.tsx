'use client';

import React from 'react';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { Play, Pause, X, Disc, SpeakerHigh } from '@phosphor-icons/react';

export const AudioPlayerBar: React.FC = () => {
  const { currentTrack, isPlaying, togglePlay, stopTrack, currentTime, duration } = useAudioPlayer();

  if (!currentTrack) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-om-border bg-om-card/95 backdrop-blur-md px-4 py-2.5 sm:px-6 shadow-2xl transition-all animate-in slide-in-from-bottom duration-300">
      {/* Progress line */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-om-border">
        <div
          className="h-full bg-om-amber transition-all duration-150"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        {/* Track Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-md border border-om-border bg-om-bg">
            {currentTrack.coverUrl ? (
              <img
                src={currentTrack.coverUrl}
                alt={currentTrack.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Disc weight="duotone" className="h-6 w-6 text-om-amber" />
              </div>
            )}
            {isPlaying && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="flex items-end gap-0.5 h-3">
                  <span className="w-0.5 bg-om-amber h-full animate-pulse" />
                  <span className="w-0.5 bg-om-amber h-2/3 animate-pulse" />
                  <span className="w-0.5 bg-om-amber h-4/5 animate-pulse" />
                </div>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="truncate text-sm font-semibold text-om-text font-sans">
              {currentTrack.title}
            </h4>
            <p className="truncate text-xs text-om-secondary">
              {currentTrack.artist} • <span className="font-mono text-om-amber">Anteprima 30s</span>
            </p>
          </div>
        </div>

        {/* Player Controls */}
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="hidden sm:flex items-center gap-2 font-mono text-xs text-om-secondary tabular-nums">
            <span>{formatTime(currentTime)}</span>
            <span>/</span>
            <span>{formatTime(duration)}</span>
          </div>

          <button
            onClick={togglePlay}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-om-amber hover:bg-om-amber/90 text-om-bg shadow-glow transition-transform active:scale-95"
            aria-label={isPlaying ? 'Pausa' : 'Riproduci'}
          >
            {isPlaying ? (
              <Pause weight="fill" className="h-5 w-5" />
            ) : (
              <Play weight="fill" className="h-5 w-5 ml-0.5" />
            )}
          </button>

          <button
            onClick={stopTrack}
            className="p-1.5 text-om-secondary hover:text-om-text rounded-md hover:bg-om-interactive transition-colors"
            aria-label="Chiudi player"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
