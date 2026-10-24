import React from 'react';
import { SealCheck, ThumbsDown, ThumbsUp, UsersThree } from '@phosphor-icons/react/dist/ssr';
import { cn, scoreStatus, type ScoreKind } from '../ui';
import { plural } from './format';

const KIND_NAME: Record<ScoreKind, string> = { critic: 'Critica', audience: 'Pubblico' };

function scoreLabel(kind: ScoreKind, percentage: number | null, count: number): string {
  const name = KIND_NAME[kind];
  if (percentage === null) return `Voto ${name.toLowerCase()}: pochi voti per un punteggio`;
  const verdict = scoreStatus(percentage) === 'FRESH' ? 'consigliato' : 'bocciato';
  return `Voto ${name.toLowerCase()}: ${percentage}% su ${plural(count, 'recensione', 'recensioni')}, ${verdict}`;
}

/**
 * Editorial score for a release or album header (ADR-001): a large tabular percentage in ink,
 * with a quiet fresh/rotten verdict underneath (icon + word, never colour alone).
 */
export function ScoreFigure({
  kind,
  percentage,
  count,
  className,
}: {
  kind: ScoreKind;
  /** 0..100, or null when there are not enough reviews yet. */
  percentage: number | null;
  count: number;
  className?: string;
}) {
  const fresh = percentage !== null && scoreStatus(percentage) === 'FRESH';
  const Thumb = fresh ? ThumbsUp : ThumbsDown;
  return (
    <div role="img" aria-label={scoreLabel(kind, percentage, count)} className={className}>
      <p
        aria-hidden="true"
        className={cn(
          'font-mono text-5xl font-light leading-none tabular-nums tracking-tight',
          percentage === null ? 'text-fg-subtle' : 'text-fg'
        )}
      >
        {percentage === null ? '—' : percentage}
        {percentage !== null && <span className="ml-0.5 text-2xl text-fg-subtle">%</span>}
      </p>
      <p aria-hidden="true" className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        {percentage === null ? (
          <span className="text-fg-subtle">Pochi voti per un punteggio</span>
        ) : (
          <>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 font-medium',
                fresh ? 'text-fresh' : 'text-rotten'
              )}
            >
              <Thumb weight="fill" className="h-4 w-4" />
              {fresh ? 'Fresco' : 'Bocciato'}
            </span>
            <span className="text-fg-subtle">
              <span className="font-mono tabular-nums">{count}</span>{' '}
              {count === 1 ? 'recensione' : 'recensioni'}
            </span>
          </>
        )}
      </p>
    </div>
  );
}

const INLINE_SIZES = {
  sm: { text: 'text-sm', icon: 'h-3.5 w-3.5' },
  md: { text: 'text-base', icon: 'h-4 w-4' },
  lg: { text: 'text-lg', icon: 'h-4 w-4' },
} as const;

/**
 * Compact score for cards and reels: kind icon + tabular percentage in ink, with a small
 * fresh/rotten thumb. No box, no fill: the cover stays the loudest thing on the card.
 */
export function ScoreInline({
  kind,
  percentage,
  count,
  size = 'sm',
  className,
}: {
  kind: ScoreKind;
  percentage: number | null;
  count: number;
  size?: keyof typeof INLINE_SIZES;
  className?: string;
}) {
  const s = INLINE_SIZES[size];
  const KindIcon = kind === 'critic' ? SealCheck : UsersThree;
  const fresh = percentage !== null && scoreStatus(percentage) === 'FRESH';
  const Thumb = fresh ? ThumbsUp : ThumbsDown;
  return (
    <span
      role="img"
      aria-label={scoreLabel(kind, percentage, count)}
      title={`${KIND_NAME[kind]}: ${percentage === null ? 'pochi voti' : plural(count, 'recensione', 'recensioni')}`}
      className={cn('inline-flex items-center gap-1.5', s.text, className)}
    >
      <KindIcon aria-hidden="true" className={cn(s.icon, 'text-fg-subtle')} />
      {percentage === null ? (
        <span aria-hidden="true" className="font-mono tabular-nums text-fg-subtle">
          —
        </span>
      ) : (
        <>
          <span aria-hidden="true" className="font-mono tabular-nums text-fg">
            {percentage}%
          </span>
          <Thumb
            aria-hidden="true"
            weight="fill"
            className={cn(s.icon, fresh ? 'text-fresh' : 'text-rotten')}
          />
        </>
      )}
    </span>
  );
}
