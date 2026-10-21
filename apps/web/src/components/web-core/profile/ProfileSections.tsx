'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, Pause, Play, SealCheck, Waveform } from '@phosphor-icons/react';
import type { Post, UserProfileData } from '@openmusic/shared';
import { api } from '@/lib/api';
import { useAudioPlayer } from '@/context/AudioPlayerContext';
import {
  Badge,
  EmptyState,
  ErrorState,
  IconButton,
  RatingStars,
  starsFromRating,
} from '@/components/ui';
import { SocialPostCard } from '@/components/SocialPostCard';
import { LoadMore } from '../LoadMore';
import { TimeAgo } from '../TimeAgo';
import { errorMessage } from '../format';
import { usePagedList } from '../usePagedList';
import { FeedSkeleton } from '../feed/PostSkeleton';

/** The user's posts, newest first, paginated. */
export function ProfilePosts({
  userId,
  isMe,
  name,
}: {
  userId: string;
  isMe: boolean;
  name: string;
}) {
  const posts = usePagedList<Post>(`user-posts:${userId}`, (cursor) =>
    api.users.posts(userId, { cursor, limit: 10 })
  );

  if (posts.status === 'idle' || posts.status === 'loading')
    return <FeedSkeleton count={2} label="Caricamento dei post…" />;
  if (posts.status === 'error') {
    return (
      <div className="p-4">
        <ErrorState
          title="Post non disponibili"
          description={errorMessage(posts.error)}
          onRetry={posts.reload}
        />
      </div>
    );
  }
  if (posts.items.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          title={isMe ? 'Non hai ancora pubblicato nulla' : `${name} non ha ancora pubblicato`}
          description={
            isMe ? 'Racconta il disco che stai ascoltando: lo vedranno i tuoi follower.' : undefined
          }
          action={
            isMe ? (
              <Link href="/#compose" className="font-semibold text-accent hover:underline">
                Scrivi il primo post
              </Link>
            ) : undefined
          }
        />
      </div>
    );
  }
  return (
    <div>
      <ul aria-label={`Post di ${name}`}>
        {posts.items.map((post) => (
          <li key={post.id}>
            <SocialPostCard
              post={post}
              onRemoved={(id) => posts.setItems((items) => items.filter((p) => p.id !== id))}
            />
          </li>
        ))}
      </ul>
      <LoadMore
        hasMore={posts.hasMore}
        loading={posts.loadingMore}
        error={posts.moreError}
        onLoadMore={posts.loadMore}
        label="Carica altri post"
      />
    </div>
  );
}

/** Latest reviews with rating, verified-listen and critic markers. */
export function ProfileReviews({
  reviews,
  isMe,
}: {
  reviews: UserProfileData['recentReviews'];
  isMe: boolean;
}) {
  if (reviews.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          title="Nessuna recensione"
          description={isMe ? 'Apri la pagina di un disco e dai il tuo voto.' : undefined}
          action={
            isMe ? (
              <Link href="/explore" className="font-semibold text-accent hover:underline">
                Esplora le uscite
              </Link>
            ) : undefined
          }
        />
      </div>
    );
  }
  return (
    <ol className="divide-y divide-line">
      {reviews.map((review) => (
        <li key={review.id} className="space-y-2 px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <RatingStars value={starsFromRating(review.rating)} size="sm" showValue label="Voto" />
            {review.isVerifiedListen && (
              <Badge tone="fresh" size="sm" icon={<Waveform weight="bold" />}>
                Ascolto verificato
              </Badge>
            )}
            {review.isCritic && (
              <Badge tone="accent" size="sm" icon={<SealCheck weight="fill" />}>
                Critica
              </Badge>
            )}
            <TimeAgo iso={review.createdAt} className="ml-auto font-mono text-xs text-ink-muted" />
          </div>
          {review.content && (
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink">
              {review.content}
            </p>
          )}
          {review.vibeTags.length > 0 && (
            <p className="font-mono text-xs text-accent">
              {review.vibeTags.map((t) => `#${t}`).join('  ')}
            </p>
          )}
          {review.releaseId && (
            <Link
              href={`/releases/${review.releaseId}`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
            >
              Vai al disco <ArrowUpRight aria-hidden="true" />
            </Link>
          )}
        </li>
      ))}
    </ol>
  );
}

/** Most played tracks (from scrobbles), with 30s previews when available. */
export function ProfileRotation({
  items,
  isMe,
}: {
  items: UserProfileData['heavyRotation'];
  isMe: boolean;
}) {
  const { playTrack, currentTrack, isPlaying } = useAudioPlayer();
  if (items.length === 0) {
    return (
      <div className="p-4">
        <EmptyState
          title="Niente in heavy rotation"
          description={
            isMe
              ? 'Collega Spotify o Last.fm dalle impostazioni per registrare i tuoi ascolti.'
              : 'Non ci sono ancora ascolti registrati.'
          }
          action={
            isMe ? (
              <Link
                href="/settings#connessioni"
                className="font-semibold text-accent hover:underline"
              >
                Collega un servizio
              </Link>
            ) : undefined
          }
        />
      </div>
    );
  }
  return (
    <ol className="divide-y divide-line">
      {items.map((item, index) => {
        const { track } = item;
        const id = `rotation-${track.id}`;
        const playing = currentTrack?.id === id && isPlaying;
        return (
          <li key={track.id} className="flex items-center gap-3 px-4 py-3 sm:px-6">
            <span className="w-6 font-mono text-sm text-ink-muted tabular-nums">
              {String(index + 1).padStart(2, '0')}
            </span>
            {track.previewUrl ? (
              <IconButton
                label={playing ? `Pausa ${track.title}` : `Ascolta 30 secondi di ${track.title}`}
                icon={playing ? <Pause weight="fill" /> : <Play weight="fill" />}
                pressed={playing}
                variant="subtle"
                size="sm"
                onClick={() =>
                  playTrack({
                    id,
                    title: track.title,
                    artist: track.artistName,
                    coverUrl: track.coverUrl ?? undefined,
                    previewUrl: track.previewUrl ?? undefined,
                  })
                }
              />
            ) : (
              <span aria-hidden="true" className="h-8 w-8" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{track.title}</p>
              <p className="truncate text-xs text-ink-secondary">{track.artistName}</p>
            </div>
            <p className="font-mono text-xs text-ink-secondary tabular-nums">
              {item.playCount} <span className="text-ink-muted">ascolti</span>
            </p>
          </li>
        );
      })}
    </ol>
  );
}
