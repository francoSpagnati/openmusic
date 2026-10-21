'use client';

import React, { useState } from 'react';
import { CheckCircle } from '@phosphor-icons/react';
import type { ReactionType, ReviewItem } from '@openmusic/shared';
import { Avatar, Badge, RatingStars, cn, starsFromRating } from '../../../components/ui';
import { formatRelative } from '../../../components/discovery/format';
import { ReviewReactions } from './ReviewReactions';

const CLAMP_CHARS = 420;

interface ReviewCardProps {
  review: ReviewItem;
  isOwn: boolean;
  onToggleReaction: ((review: ReviewItem, type: ReactionType) => void) | null;
  pendingReaction: ReactionType | null;
  loginHref: string;
}

export function myReactions(review: ReviewItem): ReactionType[] {
  if (review.userReactions) return review.userReactions;
  return review.userReaction ? [review.userReaction] : [];
}

export function ReviewCard({
  review,
  isOwn,
  onToggleReaction,
  pendingReaction,
  loginHref,
}: ReviewCardProps) {
  const [expanded, setExpanded] = useState(false);
  const name = review.user.displayName ?? review.user.username;
  const stars = starsFromRating(review.rating);
  const content = review.content?.trim() ?? '';
  const long = content.length > CLAMP_CHARS;
  const edited = review.updatedAt !== review.createdAt;

  return (
    <article
      aria-label={`Recensione di ${name}`}
      className={cn('om-sleeve space-y-3 p-4 sm:p-5', isOwn && 'border-accent/50')}
    >
      <header className="flex items-start gap-3">
        <Avatar name={name} src={review.user.avatarUrl} size="md" decorative />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <span className="font-semibold text-ink">{name}</span>
            <span className="text-ink-muted">@{review.user.username}</span>
            {isOwn && (
              <Badge tone="accent" size="sm">
                La tua
              </Badge>
            )}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <RatingStars value={stars} size="sm" label={`Voto: ${stars} stelle su 5`} />
            {review.isVerifiedListen && (
              <Badge
                tone="fresh"
                size="sm"
                icon={<CheckCircle weight="fill" />}
                title="Ha ascoltato almeno 3 brani del disco: il suo voto pesa 1,5×"
              >
                Ascolto verificato
              </Badge>
            )}
            <time
              dateTime={review.updatedAt}
              className="font-mono text-[11px] tabular-nums text-ink-muted"
            >
              {formatRelative(review.updatedAt)}
              {edited && ' · modificata'}
            </time>
          </p>
        </div>
      </header>

      {content && (
        <div>
          <p
            className={cn(
              'whitespace-pre-line text-sm leading-relaxed text-ink',
              !expanded && long && 'line-clamp-6'
            )}
          >
            {content}
          </p>
          {long && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="mt-1 text-xs font-semibold text-accent underline-offset-4 hover:underline"
            >
              {expanded ? 'Mostra meno' : 'Leggi tutta'}
            </button>
          )}
        </div>
      )}

      {review.vibeTags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Vibe">
          {review.vibeTags.map((tag) => (
            <li key={tag}>
              <Badge tone="neutral" variant="outline" size="sm" mono>
                #{tag}
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <ReviewReactions
        counts={review.reactions}
        mine={myReactions(review)}
        onToggle={onToggleReaction ? (type) => onToggleReaction(review, type) : null}
        loginHref={loginHref}
        disabled={isOwn}
        pending={pendingReaction}
      />
    </article>
  );
}
