'use client';

import React, { useEffect, useState } from 'react';
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

interface TrackGroup {
  id: string;
  label: string;
  tracks: CatalogTrack[];
  offset: number;
}

/**
 * Multi-disc releases (disc numbers from Deezer/MusicBrainz) are grouped by disc; single-disc
 * ones are split into vinyl sides, and short releases stay on one side.
 */
export function groupTracks(tracks: CatalogTrack[]): TrackGroup[] {
  const discs = new Set(tracks.map((t) => t.discNumber ?? 1));
  if (discs.size > 1) {
    const groups: TrackGroup[] = [];
    let offset = 0;
    for (const disc of Array.from(discs).sort((a, b) => a - b)) {
      const discTracks = tracks.filter((t) => (t.discNumber ?? 1) === disc);
      groups.push({ id: `disc-${disc}`, label: `Disco ${disc}`, tracks: discTracks, offset });
      offset += discTracks.length;
    }
    return groups;
  }
  if (tracks.length <= 4) return [{ id: 'A', label: 'Lato A', tracks, offset: 0 }];
  const half = Math.ceil(tracks.length / 2);
  return [
    { id: 'A', label: 'Lato A', tracks: tracks.slice(0, half), offset: 0 },
    { id: 'B', label: 'Lato B', tracks: tracks.slice(half), offset: half },
  ];
}

/** `#track-<uuid>` (set by search results and external links) -> track id. */
function trackIdFromHash(): string | null {
  const match = /^#track-([0-9a-f-]{36})$/i.exec(window.location.hash);
  return match?.[1] ?? null;
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
  const sides = groupTracks(tracks);
  const [activeSide, setActiveSide] = useState(sides[0]?.id ?? 'A');
  const [focusedTrack, setFocusedTrack] = useState<string | null>(null);

  // Deep link to one track: open its side/disc, scroll to it and mark it.
  useEffect(() => {
    const id = trackIdFromHash();
    const side = id ? groupTracks(tracks).find((g) => g.tracks.some((t) => t.id === id)) : null;
    if (!id || !side) return;
    setActiveSide(side.id);
    setFocusedTrack(id);
    window.requestAnimationFrame(() =>
      document.getElementById(`track-${id}`)?.scrollIntoView({ block: 'center' })
    );
  }, [tracks]);

  if (tracks.length === 0) {
    return (
      <EmptyState
        size="compact"
        title="Tracklist in arrivo"
        description={`Non abbiamo ancora i brani di ${releaseTitle}.`}
      />
    );
  }

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
            const number = track.trackNumber ?? side.offset + index + 1;
            return (
              <li
                key={track.id}
                id={`track-${track.id}`}
                aria-current={focusedTrack === track.id ? 'true' : undefined}
                // Warm the preview while the pointer approaches, so the click starts instantly.
                onPointerEnter={() => preload(toPlayingTrack(track, fallback))}
                className={cn(
                  'flex scroll-mt-24 items-center gap-3 rounded-sm px-2 py-2.5 transition-colors duration-fast',
                  playing ? 'bg-accent/10' : 'hover:bg-ink/5',
                  focusedTrack === track.id && !playing && 'ring-1 ring-inset ring-accent/60'
                )}
              >
                <span className="w-6 text-right font-mono text-xs tabular-nums text-ink-muted">
                  {String(number).padStart(2, '0')}
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
          label={sides[0]?.id.startsWith('disc') ? 'Dischi' : 'Lati del disco'}
          value={activeSide}
          onValueChange={setActiveSide}
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
