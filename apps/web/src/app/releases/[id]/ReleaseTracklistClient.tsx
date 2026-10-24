'use client';

import React, { useEffect, useState } from 'react';
import type { CatalogTrack } from '@openmusic/shared';
import { useAudioPlayer } from '../../../context/AudioPlayerContext';
import { EmptyState, Tabs, cn } from '../../../components/ui';
import { PreviewPlayButton } from '../../../components/discovery/PreviewPlayButton';
import { toPlayingTrack } from '../../../components/discovery/ReleasePreviewButton';
import { formatClock, formatTrackDuration, plural } from '../../../components/discovery/format';

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
        <p className="om-eyebrow mb-1 flex items-baseline justify-between gap-3 px-2 sm:px-3">
          <span>{plural(side.tracks.length, 'brano', 'brani')}</span>
          <span className="font-mono tabular-nums">{formatTrackDuration(sideMs)}</span>
        </p>
        <ol className="border-t border-line">
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
                  'flex scroll-mt-24 items-center gap-3 border-b border-line px-2 py-2 transition-colors duration-fast sm:gap-4 sm:px-3',
                  playing ? 'bg-accent/[0.06]' : 'hover:bg-fg/[0.03]',
                  focusedTrack === track.id && !playing && 'bg-fg/[0.04]'
                )}
              >
                <span className="w-6 shrink-0 text-right font-mono text-sm tabular-nums text-fg-subtle">
                  {number}
                </span>
                <PreviewPlayButton
                  track={toPlayingTrack(track, fallback)}
                  label={track.title}
                  size="sm"
                  variant={playing ? 'subtle' : 'ghost'}
                  shape="round"
                  // 32px visual, 44px hit area (WCAG 2.5.5) without growing the row.
                  className="relative before:absolute before:-inset-1.5 before:content-['']"
                />
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-[0.9375rem]',
                    playing ? 'font-medium text-accent' : 'text-fg'
                  )}
                >
                  {track.title}
                  {track.artistName !== tracks[0]?.artistName && (
                    <span className="text-fg-muted">, {track.artistName}</span>
                  )}
                </span>
                <span className="shrink-0 font-mono text-sm tabular-nums text-fg-muted">
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
    <section aria-labelledby="tracklist-heading" className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="tracklist-heading" className="om-headline text-3xl text-fg">
          Tracklist
        </h2>
        <p className="text-sm text-fg-subtle">
          {plural(tracks.length, 'brano', 'brani')},{' '}
          <span className="font-mono tabular-nums">{formatClock(totalMs / 1000)}</span>. Anteprime
          da <span className="font-mono tabular-nums">30</span> secondi.
        </p>
      </div>
      {sides.length === 1 && sides[0] ? (
        renderSide(sides[0])
      ) : (
        <Tabs
          label={sides[0]?.id.startsWith('disc') ? 'Dischi' : 'Lati del disco'}
          value={activeSide}
          onValueChange={setActiveSide}
          variant="underline"
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
