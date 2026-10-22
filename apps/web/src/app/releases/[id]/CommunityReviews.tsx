'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PencilSimple, UsersThree } from '@phosphor-icons/react';
import type { ReactionType, ReviewItem } from '@openmusic/shared';
import { api } from '../../../lib/api';
import { loginRedirectUrl, useAuth } from '../../../lib/auth';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Skeleton,
  buttonClasses,
  cn,
  useToast,
} from '../../../components/ui';
import { plural } from '../../../components/discovery/format';
import { useReleaseScore } from './ReleaseScoreContext';
import { ReviewCard, myReactions } from './ReviewCard';
import { ReviewComposer } from './ReviewComposer';

type SortMode = 'useful' | 'recent';

const reactionTotal = (r: ReviewItem) => Object.values(r.reactions).reduce((a, b) => a + b, 0);

function applyToggle(review: ReviewItem, type: ReactionType, add: boolean): ReviewItem {
  const mine = myReactions(review);
  return {
    ...review,
    reactions: {
      ...review.reactions,
      [type]: Math.max(0, (review.reactions[type] ?? 0) + (add ? 1 : -1)),
    },
    userReactions: add ? [...mine, type] : mine.filter((t) => t !== type),
    userReaction: add ? type : (mine.filter((t) => t !== type).at(-1) ?? null),
  };
}

interface CommunityReviewsProps {
  releaseId: string;
  releaseTitle: string;
  /** ADR-012: which edition this page is (null = standard edition). */
  editionLabel: string | null;
  /** Whether the album has other editions: the composer then names the one being reviewed. */
  hasOtherEditions: boolean;
  /** Server-rendered (anonymous) reviews; null when that request failed. */
  initialReviews: ReviewItem[] | null;
}

export function CommunityReviews({
  releaseId,
  releaseTitle,
  editionLabel,
  hasOtherEditions,
  initialReviews,
}: CommunityReviewsProps) {
  const router = useRouter();
  const { status, user } = useAuth();
  const { notify } = useToast();
  const { refreshScore } = useReleaseScore();
  const [reviews, setReviews] = useState<ReviewItem[] | null>(initialReviews);
  const [loadError, setLoadError] = useState(initialReviews === null);
  const [reloading, setReloading] = useState(false);
  const [sort, setSort] = useState<SortMode>('useful');
  const [pending, setPending] = useState<{ reviewId: string; type: ReactionType } | null>(null);
  const [editing, setEditing] = useState(false);
  const loginHref = loginRedirectUrl(`/releases/${releaseId}#community-heading`);

  const load = useCallback(async () => {
    setReloading(true);
    try {
      setReviews(await api.reviews.forRelease(releaseId));
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setReloading(false);
    }
  }, [releaseId]);

  // Signed-in viewers need their own reactions and review: re-read with the session cookie.
  useEffect(() => {
    if (status === 'authenticated' || (status === 'anonymous' && initialReviews === null))
      void load();
  }, [status, load, initialReviews]);

  const community = useMemo(() => {
    const list = (reviews ?? []).filter((r) => !r.isCritic);
    return [...list].sort((a, b) =>
      sort === 'recent'
        ? b.updatedAt.localeCompare(a.updatedAt)
        : reactionTotal(b) - reactionTotal(a) ||
          Number(b.isVerifiedListen) - Number(a.isVerifiedListen)
    );
  }, [reviews, sort]);

  const own = user ? (community.find((r) => r.userId === user.id) ?? null) : null;
  const others = own ? community.filter((r) => r.id !== own.id) : community;
  const asCritic = user?.role === 'CRITIC';

  const onSaved = (saved: ReviewItem | null) => {
    setEditing(false);
    if (saved) {
      setReviews((list) => [saved, ...(list ?? []).filter((r) => r.id !== saved.id)]);
      void refreshScore();
    } else {
      // Critic reviews and the critic score are server-rendered.
      router.refresh();
    }
  };

  const toggleReaction = async (review: ReviewItem, type: ReactionType) => {
    if (pending) return;
    const add = !myReactions(review).includes(type);
    const replace = (next: ReviewItem) =>
      setReviews((list) => (list ?? []).map((r) => (r.id === next.id ? next : r)));
    replace(applyToggle(review, type, add));
    setPending({ reviewId: review.id, type });
    try {
      const res = await api.reviews.toggleReaction({ reviewId: review.id, type });
      // The server is the source of truth if another tab already toggled it.
      if (res.added !== add) replace(applyToggle(review, type, res.added));
    } catch {
      replace(review);
      notify({
        title: 'Reazione non salvata',
        description: 'Controlla la connessione e riprova.',
        tone: 'error',
      });
    } finally {
      setPending(null);
    }
  };

  const renderCard = (review: ReviewItem) => (
    <ReviewCard
      key={review.id}
      review={review}
      isOwn={review.userId === user?.id}
      onToggleReaction={status === 'authenticated' ? (r, t) => void toggleReaction(r, t) : null}
      pendingReaction={pending?.reviewId === review.id ? pending.type : null}
      loginHref={loginHref}
    />
  );

  return (
    <section aria-labelledby="community-heading" className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2
          id="community-heading"
          className="om-headline flex items-center gap-2 text-2xl text-ink"
        >
          <UsersThree aria-hidden="true" weight="duotone" className="h-6 w-6 text-accent" />
          Il pubblico
          {reviews && (
            <span className="font-mono text-sm font-normal tabular-nums text-ink-muted">
              {plural(community.length, 'recensione', 'recensioni')}
            </span>
          )}
        </h2>
        {community.length > 1 && (
          <div
            role="group"
            aria-label="Ordina le recensioni"
            className="inline-flex rounded-md border border-line bg-sunken p-0.5"
          >
            {(
              [
                ['useful', 'Più apprezzate'],
                ['recent', 'Più recenti'],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={sort === mode}
                onClick={() => setSort(mode)}
                className={cn(
                  'rounded-[5px] px-3 py-1.5 text-sm transition-colors duration-fast focus-visible:outline focus-visible:outline-2 focus-visible:outline-focus',
                  sort === mode
                    ? 'bg-elevated font-semibold text-ink shadow-om-sm'
                    : 'text-ink-secondary hover:text-ink'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Composer / sign-in prompt */}
      {status === 'loading' ? (
        <Card padding="md" aria-busy="true">
          <span className="sr-only">Controllo l’accesso…</span>
          <Skeleton shape="text" lines={3} />
        </Card>
      ) : status === 'anonymous' ? (
        <Card
          padding="md"
          className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-ink-secondary">
            <span className="font-semibold text-ink">Hai ascoltato {releaseTitle}?</span> Accedi per
            dare il tuo voto e reagire alle recensioni.
          </p>
          <Link href={loginHref} className={buttonClasses({ size: 'sm' })}>
            Accedi per recensire
          </Link>
        </Card>
      ) : own && !editing && !asCritic ? (
        <div className="space-y-2">
          {renderCard(own)}
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<PencilSimple />}
            onClick={() => setEditing(true)}
          >
            Modifica la tua recensione
          </Button>
        </div>
      ) : (
        <Card padding="lg">
          <ReviewComposer
            releaseId={releaseId}
            releaseTitle={releaseTitle}
            edition={hasOtherEditions || editionLabel ? { label: editionLabel } : null}
            existing={asCritic ? null : own}
            asCritic={asCritic}
            onSaved={onSaved}
          />
          {editing && (
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setEditing(false)}>
              Annulla le modifiche
            </Button>
          )}
        </Card>
      )}

      {/* List */}
      {loadError && !reviews ? (
        <ErrorState
          title="Le recensioni non sono arrivate"
          description="Il server non ha risposto. Riprova tra un attimo."
          onRetry={() => void load()}
          retrying={reloading}
        />
      ) : !reviews ? (
        <div aria-busy="true" className="space-y-3">
          <span className="sr-only">Caricamento delle recensioni…</span>
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : others.length === 0 ? (
        !own && (
          <EmptyState
            size="compact"
            title="Ancora nessuna recensione del pubblico"
            description="Sii il primo: anche solo un voto aiuta chi lo sta scoprendo adesso."
          />
        )
      ) : (
        <div className="space-y-3">{others.map(renderCard)}</div>
      )}
    </section>
  );
}
