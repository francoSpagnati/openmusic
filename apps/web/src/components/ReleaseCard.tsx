'use client';

import React from 'react';
import Link from 'next/link';
import { useAudioPlayer } from '../context/AudioPlayerContext';
import { DualScoreBadge } from './DualScoreBadge';
import { Play, Pause, Disc, ArrowUpRight } from '@phosphor-icons/react';

export interface ReleaseCardData {
  id: string;
  title: string;
  artist: string;
  releaseYear: number;
  coverUrl: string;
  genre: string;
  dominantColor?: string;
  previewTrack?: {
    id: string;
    title: string;
    previewUrl: string;
  };
  criticScore: {
    freshPercentage: number;
    totalReviews: number;
    status: 'FRESH' | 'ROTTEN';
  };
  audienceScore: {
    freshPercentage: number;
    totalReviews: number;
    status: 'FRESH' | 'ROTTEN';
  };
}

export const ReleaseCard: React.FC<{ release: ReleaseCardData }> = ({ release }) => {
  const { playTrack, currentTrack, isPlaying } = useAudioPlayer();

  const isCurrentPlaying =
    release.previewTrack &&
    currentTrack?.id === release.previewTrack.id &&
    isPlaying;

  const handlePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (release.previewTrack) {
      playTrack({
        id: release.previewTrack.id,
        title: `${release.title} (${release.previewTrack.title})`,
        artist: release.artist,
        coverUrl: release.coverUrl,
        previewUrl: release.previewTrack.previewUrl,
      });
    }
  };

  return (
    <div className="group relative flex flex-col rounded-xl border border-om-border bg-om-card p-4 transition-all duration-300 hover:border-om-amber/60 hover:shadow-glow">
      {/* Dynamic tint layer */}
      <div
        className="pointer-events-none absolute inset-0 rounded-xl opacity-0 group-hover:opacity-10 transition-opacity duration-300"
        style={{
          backgroundColor: release.dominantColor || '#D97736',
        }}
      />

      {/* Album Cover & Play Overlay */}
      <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-om-border bg-om-bg">
        <img
          src={release.coverUrl}
          alt={release.title}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Hover action overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-om-bg/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
          <span className="text-[10px] font-mono uppercase tracking-wider text-om-secondary bg-om-card/80 px-2 py-0.5 rounded border border-om-border">
            {release.genre}
          </span>

          {release.previewTrack && (
            <button
              onClick={handlePlay}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-om-amber text-om-bg shadow-glow hover:scale-110 active:scale-95 transition-transform"
              aria-label="Ascolta anteprima 30s"
            >
              {isCurrentPlaying ? (
                <Pause weight="fill" className="h-5 w-5" />
              ) : (
                <Play weight="fill" className="h-5 w-5 ml-0.5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Album Information */}
      <div className="mt-3.5 flex flex-col flex-1 justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <Link href={`/releases/${release.id}`} className="group-hover:text-om-amber transition-colors">
              <h3 className="font-editorial text-lg font-bold text-om-text line-clamp-1">
                {release.title}
              </h3>
            </Link>
            <Link
              href={`/releases/${release.id}`}
              className="text-om-secondary hover:text-om-amber p-0.5 rounded"
              aria-label="Dettagli album"
            >
              <ArrowUpRight size={16} />
            </Link>
          </div>

          <p className="text-xs text-om-secondary mt-0.5">
            {release.artist} • <span className="font-mono tabular-nums">{release.releaseYear}</span>
          </p>
        </div>

        {/* Dual Score Section */}
        <div className="mt-4 pt-3 border-t border-om-border/60">
          <DualScoreBadge
            criticScore={release.criticScore}
            audienceScore={release.audienceScore}
            size="sm"
          />
        </div>
      </div>
    </div>
  );
};
