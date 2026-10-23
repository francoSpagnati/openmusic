'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ArrowSquareOut, CheckCircle, Disc, Headphones } from '@phosphor-icons/react';
import type { CatalogTrack, ChatReactionType, UniversalTrackLinks } from '@openmusic/shared';
import { useAudioPlayer } from '@/context/AudioPlayerContext';
import { Badge, Button, cn } from '@/components/ui';
import { CoverArt } from '@/components/discovery/CoverArt';
import { PreviewPlayButton } from '@/components/discovery/PreviewPlayButton';
import { formatTrackDuration } from '@/components/discovery/format';
import { catalogToPlayingTrack } from '../track';
import { REACTIONS, reactionMeta } from './chatFormat';

interface SharedTrackCardProps {
  track: CatalogTrack;
  links?: UniversalTrackLinks | null;
  /** The viewer sent this recommendation (shows the friend's feedback instead of controls). */
  mine: boolean;
  isListened: boolean;
  reaction: ChatReactionType | null;
  peerName: string;
  /** Receiver-only actions; omitted while the message is not confirmed by the server. */
  onReact?: (reaction: ChatReactionType | null) => void;
  onListened?: () => void;
}

const EXTERNAL_LINKS: ReadonlyArray<{ key: 'spotify' | 'appleMusic' | 'deezer'; label: string }> = [
  { key: 'spotify', label: 'Spotify' },
  { key: 'appleMusic', label: 'Apple Music' },
  { key: 'deezer', label: 'Deezer' },
];

/** A recommended track inside a chat bubble: preview, open-anywhere links, feedback. */
export function SharedTrackCard({
  track,
  links,
  mine,
  isListened,
  reaction,
  peerName,
  onReact,
  onListened,
}: SharedTrackCardProps) {
  const playing = catalogToPlayingTrack(track);
  const { currentTrack, status } = useAudioPlayer();
  const isPlayingThis = currentTrack?.id === track.id && status === 'playing';

  // Playing the preview of a received track counts as listening to it (tells the sender once).
  // Only once per card, so a failed request does not retry in a loop while the preview plays.
  const autoMarked = useRef(false);
  useEffect(() => {
    if (!isPlayingThis || mine || isListened || !onListened || autoMarked.current) return;
    autoMarked.current = true;
    onListened();
  }, [isPlayingThis, mine, isListened, onListened]);

  return (
    <div
      className={cn(
        'w-full max-w-md rounded-lg border border-line bg-canvas p-3 text-fg',
        mine && 'ml-auto'
      )}
    >
      <div className="flex items-center gap-3">
        <CoverArt
          src={track.coverUrl}
          alt=""
          sizes="48px"
          className={cn(
            'h-12 w-12 shrink-0 rounded-md transition-shadow duration-base ease-out',
            isPlayingThis && 'ring-2 ring-accent ring-offset-2 ring-offset-canvas'
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-editorial text-base leading-snug text-fg">{track.title}</p>
          <p className="truncate text-sm text-fg-muted">{track.artistName}</p>
        </div>
        <span className="shrink-0 font-mono text-xs tabular-nums text-fg-subtle">
          <span className="sr-only">Durata </span>
          {formatTrackDuration(track.durationMs)}
        </span>
        <PreviewPlayButton track={playing} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-2.5 text-xs">
        <span className="text-fg-subtle">Ascolta su</span>
        {EXTERNAL_LINKS.map(({ key, label }) => {
          const href = links?.[key];
          return href ? (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-fg-muted underline-offset-2 transition-colors duration-fast hover:text-fg hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
            >
              {label}
              <ArrowSquareOut aria-hidden="true" className="h-3 w-3" />
              <span className="sr-only"> (si apre in una nuova scheda)</span>
            </a>
          ) : null;
        })}
        {track.releaseId && (
          <Link
            href={`/releases/${encodeURIComponent(track.releaseId)}`}
            className="inline-flex items-center gap-1 text-accent underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
          >
            <Disc aria-hidden="true" className="h-3.5 w-3.5" /> Scheda del disco
          </Link>
        )}
      </div>

      {mine ? (
        <SenderFeedback isListened={isListened} reaction={reaction} peerName={peerName} />
      ) : (
        onReact && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Reagisci al consiglio" className="flex gap-1">
              {REACTIONS.map((r) => {
                const active = reaction === r.type;
                return (
                  <button
                    key={r.type}
                    type="button"
                    aria-pressed={active}
                    title={r.label}
                    onClick={() => onReact(active ? null : r.type)}
                    className={cn(
                      'inline-flex h-9 min-w-9 items-center justify-center rounded-full border px-2 text-base transition-colors duration-fast ease-out',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                      active
                        ? 'border-accent bg-accent/[0.08]'
                        : 'border-line hover:border-line-strong hover:bg-fg/[0.04]'
                    )}
                  >
                    <span aria-hidden="true">{r.emoji}</span>
                    <span className="sr-only">{r.label}</span>
                  </button>
                );
              })}
            </div>
            {isListened ? (
              <Badge tone="fresh" size="sm" icon={<CheckCircle weight="fill" />}>
                Ascoltato
              </Badge>
            ) : (
              onListened && (
                <Button
                  size="sm"
                  variant="ghost"
                  leadingIcon={<Headphones aria-hidden="true" />}
                  onClick={onListened}
                >
                  L’ho ascoltato
                </Button>
              )
            )}
          </div>
        )
      )}
    </div>
  );
}

function SenderFeedback({
  isListened,
  reaction,
  peerName,
}: {
  isListened: boolean;
  reaction: ChatReactionType | null;
  peerName: string;
}) {
  if (!isListened && !reaction) {
    return <p className="mt-2.5 text-xs text-fg-subtle">{peerName} non l’ha ancora ascoltato.</p>;
  }
  const meta = reaction ? reactionMeta(reaction) : null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {isListened && (
        <Badge tone="fresh" size="sm" icon={<CheckCircle weight="fill" />}>
          {peerName} l’ha ascoltato
        </Badge>
      )}
      {meta && (
        <Badge tone="accent" size="sm">
          <span aria-hidden="true">{meta.emoji}</span> {meta.label}
        </Badge>
      )}
    </div>
  );
}
