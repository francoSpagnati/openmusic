import React from 'react';
import Link from 'next/link';
import { ArrowSquareOut, SealCheck } from '@phosphor-icons/react/dist/ssr';
import type { CriticReviewItem } from '@openmusic/shared';
import { Avatar, Badge, EmptyState, ErrorState, RatingStars } from '../../../components/ui';
import { formatDate, formatStars, ratingToStars } from '../../../components/discovery/format';

function CriticReview({ review, featured }: { review: CriticReviewItem; featured: boolean }) {
  const fresh = review.rating >= 70;
  return (
    <article className="space-y-3 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Avatar
          name={review.criticName}
          src={review.criticAvatarUrl ?? null}
          size="sm"
          decorative
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{review.outletName}</p>
          <p className="truncate text-xs text-ink-secondary">{review.criticName}</p>
        </div>
        <Badge tone={fresh ? 'fresh' : 'rotten'} mono>
          {review.rating}/100 · {fresh ? 'fresco' : 'bocciato'}
        </Badge>
      </header>
      <blockquote
        className={
          featured
            ? 'om-pullquote text-ink'
            : 'border-l-2 border-line-strong pl-3 font-editorial italic text-ink-secondary'
        }
      >
        <p>“{review.quoteSnippet}”</p>
      </blockquote>
      <footer className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
        <span className="flex items-center gap-2">
          <RatingStars
            value={ratingToStars(review.rating)}
            size="sm"
            label={`${formatStars(ratingToStars(review.rating))} stelle su 5`}
          />
          <time dateTime={review.createdAt} className="font-mono tabular-nums">
            {formatDate(review.createdAt)}
          </time>
        </span>
        {review.originalReviewUrl && (
          <a
            href={review.originalReviewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
          >
            Leggi la recensione completa
            <ArrowSquareOut aria-hidden="true" className="h-3.5 w-3.5" />
            <span className="sr-only">(su {review.outletName}, si apre in una nuova scheda)</span>
          </a>
        )}
      </footer>
    </article>
  );
}

/** Accredited critic reviews (server-rendered: quotable, indexable). */
export function CriticReviews({ reviews }: { reviews: CriticReviewItem[] | null }) {
  return (
    <section aria-labelledby="critics-heading" className="space-y-4">
      <h2 id="critics-heading" className="om-headline flex items-center gap-2 text-2xl text-ink">
        <SealCheck aria-hidden="true" weight="duotone" className="h-6 w-6 text-fresh" />
        La critica
      </h2>
      {reviews === null ? (
        <ErrorState
          variant="inline"
          title="Le recensioni della critica non sono arrivate"
          description="Ricarica la pagina tra poco."
        />
      ) : reviews.length === 0 ? (
        <EmptyState
          size="compact"
          title="Nessuna testata l’ha ancora recensito"
          description="Il voto della critica comparirà con la prima recensione accreditata."
          action={
            <Link
              href="/critics"
              className="text-sm font-semibold text-accent underline-offset-4 hover:underline"
            >
              Scrivi per una testata? Chiedi l’accredito
            </Link>
          }
        />
      ) : (
        <div className="space-y-5">
          {reviews.map((review, index) => (
            <CriticReview key={review.id} review={review} featured={index === 0} />
          ))}
        </div>
      )}
    </section>
  );
}
