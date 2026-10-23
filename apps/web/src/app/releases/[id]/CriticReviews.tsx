import React from 'react';
import Link from 'next/link';
import { ArrowSquareOut, ThumbsDown, ThumbsUp } from '@phosphor-icons/react/dist/ssr';
import type { CriticReviewItem } from '@openmusic/shared';
import { externalHref } from '../../../lib/url';
import { Avatar, EmptyState, ErrorState } from '../../../components/ui';
import { formatDate, formatStars, ratingToStars } from '../../../components/discovery/format';

function CriticReview({ review, featured }: { review: CriticReviewItem; featured: boolean }) {
  const fresh = review.rating >= 70;
  const Thumb = fresh ? ThumbsUp : ThumbsDown;
  const stars = ratingToStars(review.rating);
  return (
    <article className="space-y-4 border-t border-line pt-8 first:border-t-0 first:pt-0">
      <blockquote
        className={
          featured
            ? 'om-pullquote text-2xl text-fg sm:text-[1.625rem]'
            : 'font-editorial text-xl italic leading-relaxed text-fg'
        }
      >
        <p>“{review.quoteSnippet}”</p>
      </blockquote>
      <footer className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar
            name={review.criticName}
            src={review.criticAvatarUrl ?? null}
            size="sm"
            decorative
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-fg">{review.outletName}</span>
            <span className="block truncate text-xs text-fg-subtle">
              {review.criticName},{' '}
              <time dateTime={review.createdAt}>{formatDate(review.createdAt)}</time>
            </span>
          </span>
        </span>
        <span
          role="img"
          aria-label={`${review.rating} su 100, ${formatStars(stars)} stelle su 5: ${fresh ? 'fresco' : 'bocciato'}`}
          className="inline-flex items-center gap-2 text-sm"
        >
          <span aria-hidden="true" className="font-mono tabular-nums text-fg">
            {review.rating}
            <span className="text-fg-subtle">/100</span>
          </span>
          <span
            aria-hidden="true"
            className={`inline-flex items-center gap-1 ${fresh ? 'text-fresh' : 'text-rotten'}`}
          >
            <Thumb weight="fill" className="h-4 w-4" />
            {fresh ? 'Fresco' : 'Bocciato'}
          </span>
        </span>
      </footer>
      {externalHref(review.originalReviewUrl) && (
        <a
          href={externalHref(review.originalReviewUrl) ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="om-link inline-flex items-center gap-1 rounded-sm text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus"
        >
          Leggi la recensione completa
          <ArrowSquareOut aria-hidden="true" className="h-3.5 w-3.5" />
          <span className="sr-only">(su {review.outletName}, si apre in una nuova scheda)</span>
        </a>
      )}
    </article>
  );
}

/** Accredited critic reviews (server-rendered: quotable, indexable). */
export function CriticReviews({ reviews }: { reviews: CriticReviewItem[] | null }) {
  return (
    <section aria-labelledby="critics-heading" className="space-y-6">
      <h2 id="critics-heading" className="om-headline text-3xl text-fg">
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
            <Link href="/critics" className="om-link text-sm">
              Scrivi per una testata? Chiedi l’accredito
            </Link>
          }
        />
      ) : (
        <div className="om-stagger space-y-8">
          {reviews.map((review, index) => (
            <CriticReview key={review.id} review={review} featured={index === 0} />
          ))}
        </div>
      )}
    </section>
  );
}
