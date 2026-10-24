'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowSquareOut,
  CheckCircle,
  Pause,
  Play,
  ShareNetwork,
  SpeakerSlash,
} from '@phosphor-icons/react';
import type { DiscoveryReelItem } from '@openmusic/shared';
import { useAudioPlayer } from '../../context/AudioPlayerContext';
import { IconButton, RatingStars, cn, starsFromRating } from '../../components/ui';
import { DualScoreBadge } from '../../components/DualScoreBadge';
import { CoverArt } from '../../components/discovery/CoverArt';
import { ambientTint } from '../../components/discovery/ambientTint';
import { formatStars } from '../../components/discovery/format';

interface ReelSlideProps {
  item: DiscoveryReelItem;
  index: number;
  total: number;
  active: boolean;
  /** Load the cover eagerly (current and adjacent reels). */
  near: boolean;
  onPlay: () => void;
  onShare: () => void;
  /** Short help line under the controls (first reel only). */
  hint?: string;
}

/** One full-height reel: the sleeve edge to edge, scores, the best review and the controls. */
export function ReelSlide({
  item,
  index,
  total,
  active,
  near,
  onPlay,
  onShare,
  hint,
}: ReelSlideProps) {
  const { currentTrack, status, currentTime, duration } = useAudioPlayer();
  const { track, release, topReviewSnippet: review } = item;
  const isCurrent = currentTrack?.id === track.id;
  const playing =
    isCurrent && (status === 'playing' || status === 'loading' || status === 'resolving');
  const unavailable = isCurrent && status === 'unavailable';
  const progress = isCurrent && duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const tint = ambientTint(release.dominantColor, 0.25);
  const titleId = `reel-${item.id}-title`;
  const descId = `reel-${item.id}-desc`;

  return (
    <article
      data-snap-index={index}
      tabIndex={-1}
      aria-posinset={index + 1}
      aria-setsize={total + 1 /* the feed ends with a closing card */}
      aria-labelledby={titleId}
      aria-describedby={descId}
      style={tint ? ({ '--reel-tint': tint } as React.CSSProperties) : undefined}
      className={cn(
        'relative flex h-full snap-start snap-always flex-col items-center justify-start overflow-hidden pb-24 sm:justify-center sm:px-8 sm:pt-6',
        'dark:bg-[radial-gradient(120%_60%_at_50%_0%,var(--reel-tint,transparent),transparent_70%)]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-focus'
      )}
    >
      {/* The sleeve is the reel: edge to edge on phones, as large as the height allows above. */}
      <div className="relative w-full max-w-[min(100%,48dvh)] shrink-0 sm:max-w-[min(100%,52dvh)]">
        <CoverArt
          src={release.coverUrl ?? track.coverUrl}
          placeholderColor={release.dominantColor}
          alt={`Copertina di ${release.title}`}
          sizes="(min-width: 640px) 52vh, 100vw"
          priority={index === 0}
          eager={near}
          framed
          className="aspect-square w-full sm:rounded-md"
        />
        <p className="absolute left-3 top-3 rounded-full bg-canvas/90 px-2.5 py-0.5 font-mono text-xs tabular-nums text-fg">
          <span className="sr-only">Reel </span>
          {index + 1}
          <span className="text-fg-muted"> / {total}</span>
        </p>
        <div
          className="absolute inset-x-0 bottom-0 h-0.5 bg-fg/10"
          role="progressbar"
          aria-label="Avanzamento anteprima"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          hidden={!isCurrent}
        >
          <div
            className="h-full bg-accent transition-[width] duration-fast ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex w-full max-w-md flex-col items-center gap-4 px-4 pt-5 text-center sm:px-0">
        <div className="space-y-1.5">
          <h2 id={titleId} className="om-headline text-balance text-2xl text-fg sm:text-3xl">
            {track.title}
          </h2>
          <p className="text-sm text-fg-muted">
            {track.artistName}, da{' '}
            <Link
              href={`/releases/${release.id}`}
              className="font-editorial text-base italic text-fg underline decoration-line-strong underline-offset-4 hover:decoration-current focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
              tabIndex={active ? 0 : -1}
            >
              {release.title}
            </Link>
          </p>
        </div>
        <DualScoreBadge score={release} size="sm" className="justify-center" />

        <div id={descId} className="w-full">
          {review ? (
            <figure className="space-y-1.5">
              <blockquote className="line-clamp-3 font-editorial text-base italic leading-relaxed text-fg">
                “{review.snippet}
                {review.snippet.length >= 140 ? '…' : ''}”
              </blockquote>
              <figcaption className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
                <span className="text-fg-muted">@{review.authorName}</span>
                <RatingStars
                  value={starsFromRating(review.rating)}
                  size="sm"
                  label={`${formatStars(starsFromRating(review.rating))} stelle su 5`}
                />
                {review.isVerifiedListen && (
                  <span className="inline-flex items-center gap-1 text-fresh">
                    <CheckCircle aria-hidden="true" weight="fill" className="h-3.5 w-3.5" />
                    Ascolto verificato
                  </span>
                )}
              </figcaption>
            </figure>
          ) : (
            <p className="text-sm text-fg-subtle">
              Nessuna recensione ancora: scrivi la prima dalla scheda del disco.
            </p>
          )}
        </div>

        <div className="flex items-center justify-center gap-4">
          <IconButton
            label="Condividi il disco"
            icon={<ShareNetwork />}
            variant="ghost"
            shape="round"
            onClick={onShare}
            tabIndex={active ? 0 : -1}
          />
          <IconButton
            label={
              unavailable
                ? 'Anteprima non disponibile'
                : playing
                  ? `Pausa ${track.title}`
                  : `Ascolta ${track.title}`
            }
            icon={
              unavailable ? (
                <SpeakerSlash />
              ) : playing ? (
                <Pause weight="fill" />
              ) : (
                <Play weight="fill" />
              )
            }
            variant="solid"
            size="lg"
            loading={isCurrent && (status === 'resolving' || status === 'loading')}
            disabled={unavailable}
            onClick={onPlay}
            tabIndex={active ? 0 : -1}
            className="h-14 w-14 text-xl"
          />
          <Link
            href={`/releases/${release.id}`}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-fg-muted transition-colors duration-fast hover:bg-fg/[0.05] hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            aria-label={`Apri la scheda di ${release.title}`}
            title="Apri la scheda del disco"
            tabIndex={active ? 0 : -1}
          >
            <ArrowSquareOut aria-hidden="true" className="h-5 w-5" />
          </Link>
        </div>

        {hint && !unavailable && <p className="text-xs text-fg-subtle">{hint}</p>}

        {unavailable && (
          <p role="status" className="text-xs text-fg-muted">
            Nessuna anteprima di 30 secondi per questo brano: scorri al prossimo.
          </p>
        )}
      </div>
    </article>
  );
}
