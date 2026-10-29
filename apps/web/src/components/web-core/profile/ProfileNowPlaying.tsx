'use client';

import React from 'react';
import type { NowPlayingTrack } from '@openmusic/shared';
import { Headphones, Pause } from '@phosphor-icons/react';
import { Badge, Card } from '@/components/ui';
import { CoverArt } from '@/components/discovery/CoverArt';
import { formatTrackDuration } from '@/components/discovery/format';
import { PROVIDER_LABEL, estimatedProgressMs } from '@/components/web-social/presence/presence';
import { useNow } from '@/components/web-social/presence/useNow';
import { useUserPresence } from '@/lib/socket';

/**
 * "In ascolto ora" on a profile: what the user plays right now, with a progress bar that moves
 * by itself between server updates. Hidden when nothing is playing, in Ghost Mode, or when the
 * viewer neither is nor follows the user (the API answers 404 and there is nothing to show).
 */
export function ProfileNowPlaying({ userId, name }: { userId: string; name: string }) {
  const presence = useUserPresence(userId);
  const track = presence?.currentlyPlaying;
  if (!presence || presence.isGhostMode || !track) return null;
  return <NowPlayingCard track={track} name={name} />;
}

function NowPlayingCard({
  track,
  name,
}: {
  track: NowPlayingTrack;
  name: string;
}) {
  const now = useNow(1000, track.isPlaying);
  const progress = estimatedProgressMs(track, now);
  const hasDuration = track.durationMs > 0;
  const percent = hasDuration ? Math.min(100, (progress / track.durationMs) * 100) : 0;
  const provider = PROVIDER_LABEL[track.provider];

  return (
    <section aria-labelledby="profile-now-playing" className="px-4 pt-6 sm:px-6">
      <Card padding="sm" className="om-fade flex items-center gap-4">
        <CoverArt
          key={track.coverUrl ?? track.title}
          src={track.coverUrl}
          alt=""
          sizes="96px"
          placeholderColor={track.dominantColor}
          className="aspect-square w-20 shrink-0 rounded-md border border-line sm:w-24"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2
              id="profile-now-playing"
              className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-fg-muted"
            >
              <Headphones aria-hidden="true" className="h-3.5 w-3.5" />
              In ascolto ora
            </h2>
            {!track.isPlaying && (
              <Badge size="sm" icon={<Pause aria-hidden="true" weight="fill" />}>
                In pausa
              </Badge>
            )}
          </div>
          <p className="om-headline mt-1 truncate text-xl text-fg">{track.title}</p>
          <p className="truncate text-sm text-fg-muted">
            {track.artistName}
            {track.albumTitle ? (
              <span className="font-editorial italic text-fg-subtle"> · {track.albumTitle}</span>
            ) : null}
          </p>

          {/* Last.fm "now playing" has no duration (0): no progress bar to draw. */}
          {hasDuration ? (
            <div className="mt-3">
              <div
                role="progressbar"
                aria-label={`Punto di ascolto di ${name}`}
                aria-valuemin={0}
                aria-valuemax={Math.round(track.durationMs / 1000)}
                aria-valuenow={Math.round(progress / 1000)}
                aria-valuetext={`${formatTrackDuration(progress)} di ${formatTrackDuration(track.durationMs)}`}
                className="h-1 w-full overflow-hidden rounded-full bg-sunken"
              >
                <span
                  className="block h-full rounded-full bg-fg-muted transition-[width] duration-slow ease-linear motion-reduce:transition-none"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between font-mono text-xs tabular-nums text-fg-subtle">
                <span aria-hidden="true">{formatTrackDuration(progress)}</span>
                <span className="font-sans">{provider}</span>
                <span aria-hidden="true">{formatTrackDuration(track.durationMs)}</span>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-fg-subtle">Via {provider}</p>
          )}
        </div>
      </Card>
    </section>
  );
}
