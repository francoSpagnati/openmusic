'use client';

import React from 'react';
import Link from 'next/link';
import { Pause, Play, X, ArrowClockwise } from '@phosphor-icons/react';
import { useAudioPlayer, type PlayerStatus } from '../context/AudioPlayerContext';
import { IconButton, Spinner } from './ui';
import { CoverArt } from './discovery/CoverArt';
import { formatClock } from './discovery/format';

const STATUS_TEXT: Partial<Record<PlayerStatus, string>> = {
  resolving: 'Cerco l’anteprima…',
  loading: 'La puntina sta scendendo…',
  unavailable: 'Nessuna anteprima di 30 secondi per questo brano',
  blocked: 'Il browser ha messo in pausa l’audio: premi Riproduci',
  error: 'La puntina è saltata: anteprima non caricata',
};

/** Sticky 30s preview player. Renders nothing until a track is chosen. */
export const AudioPlayerBar: React.FC = () => {
  const {
    currentTrack,
    status,
    isPlaying,
    isLoading,
    togglePlay,
    stopTrack,
    seek,
    currentTime,
    duration,
  } = useAudioPlayer();

  if (!currentTrack) return null;

  const statusText = STATUS_TEXT[status];
  const canSeek = status === 'playing' || status === 'paused';
  const max = Math.max(1, Math.round(duration));
  const retry = status === 'error' || status === 'blocked';

  return (
    <section
      aria-label="Lettore anteprime"
      className="om-fade fixed inset-x-0 bottom-0 z-playerBar border-t border-line bg-surface-raised"
    >
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
        <CoverArt
          src={currentTrack.coverUrl}
          alt=""
          className="h-11 w-11 flex-shrink-0 rounded-sm ring-1 ring-line"
          sizes="44px"
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-fg">
            {currentTrack.releaseId ? (
              <Link
                href={`/releases/${currentTrack.releaseId}`}
                className="hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
              >
                {currentTrack.title}
              </Link>
            ) : (
              currentTrack.title
            )}
          </p>
          <p className="truncate text-xs text-fg-muted" aria-live="polite">
            {statusText ?? (
              <>
                {currentTrack.artist}
                <span className="text-fg-subtle">, anteprima di 30 secondi</span>
              </>
            )}
          </p>

          <div className="mt-1.5 flex items-center gap-2">
            <span className="hidden w-9 text-right font-mono text-[11px] tabular-nums text-fg-subtle sm:inline">
              {formatClock(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={max}
              step={1}
              value={Math.min(Math.round(currentTime), max)}
              onChange={(e) => seek(Number(e.target.value))}
              disabled={!canSeek}
              aria-label="Posizione nell’anteprima"
              aria-valuetext={`${formatClock(currentTime)} di ${formatClock(duration)}`}
              className="h-1 w-full cursor-pointer accent-accent disabled:cursor-default disabled:opacity-40"
            />
            <span className="hidden w-9 font-mono text-[11px] tabular-nums text-fg-subtle sm:inline">
              {formatClock(duration)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          {status === 'resolving' ? (
            <span className="flex h-10 w-10 items-center justify-center">
              <Spinner size="sm" label="Ricerca anteprima" />
            </span>
          ) : (
            <IconButton
              label={isPlaying || isLoading ? 'Pausa' : retry ? 'Riprova' : 'Riproduci'}
              variant="outline"
              shape="round"
              loading={status === 'loading'}
              disabled={status === 'unavailable'}
              onClick={togglePlay}
              icon={
                isPlaying || isLoading ? (
                  <Pause weight="fill" />
                ) : retry ? (
                  <ArrowClockwise weight="bold" />
                ) : (
                  <Play weight="fill" />
                )
              }
            />
          )}
          <IconButton label="Chiudi il lettore" variant="ghost" onClick={stopTrack} icon={<X />} />
        </div>
      </div>
    </section>
  );
};
