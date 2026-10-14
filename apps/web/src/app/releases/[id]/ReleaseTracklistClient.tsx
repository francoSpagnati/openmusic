'use client';

import React, { useState } from 'react';
import { useAudioPlayer } from '../../../context/AudioPlayerContext';
import { Disc, Play, Pause, Clock, ShareNetwork } from '@phosphor-icons/react';

interface TrackItem {
  id: string;
  trackNumber: number;
  title: string;
  duration: number;
  previewUrl: string;
}

interface ReleaseTracklistProps {
  releaseTitle: string;
  artist: string;
  coverUrl: string;
  sideA: TrackItem[];
  sideB: TrackItem[];
}

export const ReleaseTracklistClient: React.FC<ReleaseTracklistProps> = ({
  releaseTitle,
  artist,
  coverUrl,
  sideA,
  sideB,
}) => {
  const [activeSide, setActiveSide] = useState<'A' | 'B'>('A');
  const { playTrack, currentTrack, isPlaying } = useAudioPlayer();

  const tracks = activeSide === 'A' ? sideA : sideB;

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const totalSideDuration = tracks.reduce((acc, t) => acc + t.duration, 0);

  return (
    <section className="rounded-2xl border border-om-border bg-om-card p-6 sm:p-8">
      {/* Vinyl Side Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-om-border pb-6">
        <div>
          <h2 className="font-editorial text-2xl font-bold text-om-text">
            Tracklist Vinilica
          </h2>
          <p className="text-xs text-om-secondary font-mono mt-1">
            Formato 33 RPM • Durata Lato: {formatDuration(totalSideDuration)}
          </p>
        </div>

        {/* Analog Switcher Tabs */}
        <div className="flex items-center rounded-lg border border-om-border bg-om-bg p-1 self-start sm:self-auto">
          <button
            onClick={() => setActiveSide('A')}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-mono font-semibold transition-all ${
              activeSide === 'A'
                ? 'bg-om-amber text-om-bg shadow-glow'
                : 'text-om-secondary hover:text-om-text'
            }`}
          >
            <Disc weight={activeSide === 'A' ? 'fill' : 'regular'} className="h-4 w-4" />
            <span>LATO A ({sideA.length} Tracce)</span>
          </button>

          <button
            onClick={() => setActiveSide('B')}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-mono font-semibold transition-all ${
              activeSide === 'B'
                ? 'bg-om-amber text-om-bg shadow-glow'
                : 'text-om-secondary hover:text-om-text'
            }`}
          >
            <Disc weight={activeSide === 'B' ? 'fill' : 'regular'} className="h-4 w-4" />
            <span>LATO B ({sideB.length} Tracce)</span>
          </button>
        </div>
      </div>

      {/* Track list table */}
      <div className="divide-y divide-om-border/50 mt-4">
        {tracks.map((track) => {
          const isThisTrackPlaying = currentTrack?.id === track.id && isPlaying;

          return (
            <div
              key={track.id}
              onClick={() =>
                playTrack({
                  id: track.id,
                  title: track.title,
                  artist,
                  coverUrl,
                  previewUrl: track.previewUrl,
                })
              }
              className={`group flex items-center justify-between py-3.5 px-3 rounded-lg transition-colors cursor-pointer ${
                isThisTrackPlaying
                  ? 'bg-om-interactive/80 text-om-amber'
                  : 'hover:bg-om-interactive/40 text-om-text'
              }`}
            >
              <div className="flex items-center gap-4 min-w-0">
                <span className="w-6 text-center font-mono text-xs text-om-secondary tabular-nums">
                  {track.trackNumber < 10 ? `0${track.trackNumber}` : track.trackNumber}
                </span>

                <button
                  className={`flex h-7 w-7 items-center justify-center rounded-full transition-transform group-hover:scale-105 ${
                    isThisTrackPlaying
                      ? 'bg-om-amber text-om-bg'
                      : 'bg-om-interactive text-om-secondary group-hover:bg-om-amber group-hover:text-om-bg'
                  }`}
                  aria-label="Play track preview"
                >
                  {isThisTrackPlaying ? (
                    <Pause weight="fill" className="h-3.5 w-3.5" />
                  ) : (
                    <Play weight="fill" className="h-3.5 w-3.5 ml-0.5" />
                  )}
                </button>

                <span className="font-sans text-sm font-medium truncate group-hover:text-om-amber transition-colors">
                  {track.title}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono text-om-secondary tabular-nums">
                <span className="hidden sm:inline text-[11px] text-om-muted">Anteprima 30s</span>
                <span>{formatDuration(track.duration)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
