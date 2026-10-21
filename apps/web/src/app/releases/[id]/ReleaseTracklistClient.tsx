'use client';

import React from 'react';
import { Disc } from '@phosphor-icons/react';
import type { CatalogTrack } from '@openmusic/shared';
import { useAudioPlayer } from '../../../context/AudioPlayerContext';
import { EmptyState, Tabs, cn } from '../../../components/ui';
import { PreviewPlayButton } from '../../../components/discovery/PreviewPlayButton';
import { toPlayingTrack } from '../../../components/discovery/ReleasePreviewButton';
import { formatClock, formatTrackDuration } from '../../../components/discovery/format';

interface ReleaseTracklistProps {
  releaseId: string;
  releaseTitle: string;
  coverUrl: string | null | undefined;
  tracks: CatalogTrack[];
}

/** Splits a tracklist into vinyl sides; short releases stay on one side. */
function toSides(
  tracks: CatalogTrack[]
): Array<{ id: string; label: string; tracks: CatalogTrack[]; offset: number }> {
  if (tracks.length <= 4) return [{ id: 'A', label: 'Lato A', tracks, offset: 0 }];
  const half = Math.ceil(tracks.length / 2);
  return [
    { id: 'A', label: 'Lato A', tracks: tracks.slice(0, half), offset: 0 },
    { id: 'B', label: 'Lato B', tracks: tracks.slice(half), offset: half },
  ];
}

export const ReleaseTracklistClient: React.FC<ReleaseTracklistProps> = ({
  releaseId,
  releaseTitle,
  coverUrl,
  tracks,
}) => {
  const { currentTrack, status, preload } = useAudioPlayer();
  const totalMs = tracks.reduce((sum, t) => sum + t.durationMs, 0);
  const fallback = { coverUrl, releaseId };

  if (tracks.length === 0) {
    return (
      <EmptyState
        size="compact"
        title="Tracklist in arrivo"
        description={`Non abbiamo ancora i brani di ${releaseTitle}.`}
      />
    );
  }

  const sides = toSides(tracks);
  const renderSide = (side: (typeof sides)[number]) => {
    const sideMs = side.tracks.reduce((sum, t) => sum + t.durationMs, 0);
    return (
      <div>
        <p className="om-eyebrow mb-2">
          {side.label} · {side.tracks.length} brani ·{' '}
          <span className="tabular-nums">{formatTrackDuration(sideMs)}</span>
        </p>
        <ol className="divide-y divide-line">
          {side.tracks.map((track, index) => {
            const playing = currentTrack?.id === track.id && status !== 'idle';
            return (
              <li
                key={track.id}
                // Warm the preview while the pointer approaches, so the click starts instantly.
                onPointerEnter={() => preload(toPlayingTrack(track, fallback))}
                className={cn(
                  'flex items-center gap-3 rounded-sm px-2 py-2.5 transition-colors duration-fast',
                  playing ? 'bg-accent/10' : 'hover:bg-ink/5'
                )}
              >
                <span className="w-6 text-right font-mono text-xs tabular-nums text-ink-muted">
                  {String(side.offset + index + 1).padStart(2, '0')}
                </span>
                <PreviewPlayButton
                  track={toPlayingTrack(track, fallback)}
                  label={track.title}
                  size="sm"
                  variant={playing ? 'solid' : 'subtle'}
                />
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-sm',
                    playing ? 'font-semibold text-accent' : 'text-ink'
                  )}
                >
                  {track.title}
                  {track.artistName !== tracks[0]?.artistName && (
                    <span className="text-ink-secondary"> · {track.artistName}</span>
                  )}
                </span>
                <span className="font-mono text-xs tabular-nums text-ink-secondary">
                  {formatTrackDuration(track.durationMs)}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    );
  };

  return (
    <section aria-labelledby="tracklist-heading" className="om-sleeve p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="tracklist-heading"
            className="om-headline flex items-center gap-2 text-2xl text-ink"
          >
            <Disc aria-hidden="true" weight="duotone" className="h-6 w-6 text-accent" />
            Tracklist
          </h2>
          <p className="mt-1 font-mono text-xs tabular-nums text-ink-secondary">
            {tracks.length} brani · {formatClock(totalMs / 1000)} · anteprime da 30 secondi
          </p>
        </div>
      </div>
      {sides.length === 1 && sides[0] ? (
        renderSide(sides[0])
      ) : (
        <Tabs
          label="Lati del disco"
          variant="pill"
          items={sides.map((side) => ({
            id: side.id,
            label: side.label,
            count: side.tracks.length,
            content: renderSide(side),
          }))}
        />
      )}
    </section>
  );
};
