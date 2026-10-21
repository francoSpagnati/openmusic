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
import {
  Badge,
  IconButton,
  RatingStars,
  buttonClasses,
  cn,
  starsFromRating,
} from '../../components/ui';
import { DualScoreBadge } from '../../components/DualScoreBadge';
import { CoverArt } from '../../components/discovery/CoverArt';
import { ambientTint } from '../../components/discovery/ambientTint';
import { formatStars, releaseEyebrow } from '../../components/discovery/format';

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

/** One full-height reel: sleeve + disc, scores, the best review and the preview controls. */
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
  const tint = ambientTint(release.dominantColor);
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
        'relative flex h-full snap-start snap-always flex-col items-center justify-center gap-5 overflow-hidden px-4 pb-24 pt-6 sm:px-8',
        'bg-[radial-gradient(120%_70%_at_50%_0%,var(--reel-tint,transparent),transparent_70%)] [[data-theme=light]_&]:bg-none',
        'focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-focus'
      )}
    >
      <p className="om-eyebrow absolute left-4 top-4 tabular-nums sm:left-8">
        {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </p>

      {/* Sleeve with the record sliding out while it plays */}
      <div className="relative w-[min(72vw,22rem)] shrink-0 sm:w-[min(40vh,24rem)]">
        <span
          aria-hidden="true"
          className={cn(
            'om-grooves absolute inset-[3%] transition-transform duration-slow ease-tonearm',
            playing ? 'translate-x-[28%]' : 'translate-x-0'
          )}
        >
          {/* Light catching the grooves: the only visible sign that a symmetric disc spins */}
          <span
            className={cn(
              'absolute inset-0 rounded-full bg-[conic-gradient(transparent_0_18%,rgb(var(--om-text)/0.09)_25%,transparent_32%_68%,rgb(var(--om-text)/0.09)_75%,transparent_82%)]',
              playing && status === 'playing' && 'om-spin-record'
            )}
          />
        </span>
        <CoverArt
          src={release.coverUrl ?? track.coverUrl}
          placeholderColor={release.dominantColor}
          alt={`Copertina di ${release.title}`}
          sizes="(min-width: 640px) 24rem, 72vw"
          priority={index === 0}
          className="relative aspect-square w-full rounded-sleeve shadow-om-lg"
          eager={near}
        />
      </div>

      <div className="w-full max-w-md space-y-3 text-center">
        <p className="om-eyebrow">{releaseEyebrow(release)}</p>
        <h2 id={titleId} className="om-headline text-2xl text-ink sm:text-3xl">
          {track.title}
        </h2>
        <p className="om-deck text-base">
          {track.artistName} · da{' '}
          <Link
            href={`/releases/${release.id}`}
            className="underline decoration-line-strong underline-offset-4 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
          >
            {release.title}
          </Link>
        </p>
        <DualScoreBadge score={release} size="sm" className="justify-center" />
      </div>

      <div id={descId} className="w-full max-w-md">
        {review ? (
          <figure className="space-y-2 rounded-md border border-line bg-surface/80 p-3 text-left">
            <blockquote className="font-editorial text-sm italic leading-relaxed text-ink">
              “{review.snippet}
              {review.snippet.length >= 140 ? '…' : ''}”
            </blockquote>
            <figcaption className="flex flex-wrap items-center gap-2 text-xs text-ink-secondary">
              <span className="font-semibold text-ink">@{review.authorName}</span>
              <RatingStars
                value={starsFromRating(review.rating)}
                size="sm"
                label={`${formatStars(starsFromRating(review.rating))} stelle su 5`}
              />
              {review.isVerifiedListen && (
                <Badge tone="fresh" size="sm" icon={<CheckCircle weight="fill" />}>
                  Ascolto verificato
                </Badge>
              )}
            </figcaption>
          </figure>
        ) : (
          <p className="text-center text-sm text-ink-muted">
            Nessuna recensione ancora: scrivi la prima dalla scheda del disco.
          </p>
        )}
      </div>

      <div className="flex w-full max-w-md items-center justify-center gap-3">
        <IconButton
          label="Condividi il disco"
          icon={<ShareNetwork />}
          variant="subtle"
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
          className="h-16 w-16 text-2xl"
        />
        <Link
          href={`/releases/${release.id}`}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-elevated text-ink transition-colors duration-fast hover:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          aria-label={`Apri la scheda di ${release.title}`}
          title="Apri la scheda del disco"
          tabIndex={active ? 0 : -1}
        >
          <ArrowSquareOut aria-hidden="true" className="h-5 w-5" />
        </Link>
      </div>

      {hint && !unavailable && <p className="-mt-2 text-center text-xs text-ink-muted">{hint}</p>}

      {unavailable && (
        <p role="status" className="-mt-2 text-center text-xs text-ink-secondary">
          Nessuna anteprima di 30 secondi per questo brano: scorri al prossimo.
        </p>
      )}

      <div
        className="absolute inset-x-0 bottom-0 h-1 bg-line"
        role="progressbar"
        aria-label="Avanzamento anteprima"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        hidden={!isCurrent}
      >
        <div
          className="h-full bg-accent transition-[width] duration-fast ease-standard"
          style={{ width: `${progress}%` }}
        />
      </div>
    </article>
  );
}
