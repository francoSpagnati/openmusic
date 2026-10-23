import React from 'react';
import { SealCheck, ThumbsDown, ThumbsUp, UsersThree } from '@phosphor-icons/react/dist/ssr';
import { cn } from './cn';

export type ScoreKind = 'critic' | 'audience';
export type ScoreStatus = 'FRESH' | 'ROTTEN';
export type ScoreBadgeSize = 'sm' | 'md' | 'lg';

/** Product rule: a release is "fresh" when >= 70% of reviews recommend it. */
export const FRESH_THRESHOLD = 70;

export function scoreStatus(percentage: number): ScoreStatus {
  return percentage >= FRESH_THRESHOLD ? 'FRESH' : 'ROTTEN';
}

export interface ScoreBadgeProps {
  kind: ScoreKind;
  /** 0..100, or null when there are not enough reviews yet. */
  percentage: number | null;
  totalReviews?: number;
  /** Override the computed status (e.g. when the API already returns it). */
  status?: ScoreStatus;
  size?: ScoreBadgeSize;
  className?: string;
}

const kindLabel: Record<ScoreKind, string> = { critic: 'Critica', audience: 'Pubblico' };

const sizes: Record<ScoreBadgeSize, { box: string; value: string; icon: string }> = {
  sm: { box: 'gap-1.5 px-2 py-1', value: 'text-sm', icon: 'h-3.5 w-3.5' },
  md: { box: 'gap-2 px-3 py-2', value: 'text-lg', icon: 'h-4 w-4' },
  lg: { box: 'gap-3 px-4 py-3', value: 'text-3xl', icon: 'h-5 w-5' },
};

/**
 * Fresh/rotten score. State is conveyed by icon (thumb up/down) + text, not
 * colour alone. Critic uses a seal, audience uses people.
 */
export function ScoreBadge({
  kind,
  percentage,
  totalReviews,
  status,
  size = 'md',
  className,
}: ScoreBadgeProps) {
  const s = sizes[size];
  const KindIcon = kind === 'critic' ? SealCheck : UsersThree;

  if (percentage === null) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-lg border border-dashed border-line-strong text-fg-subtle',
          s.box,
          className
        )}
      >
        <KindIcon aria-hidden="true" weight="regular" className={s.icon} />
        <span className="flex flex-col leading-none">
          <span className={cn('font-mono font-medium tabular-nums', s.value)}>—</span>
          <span className="mt-0.5 text-[11px]">{kindLabel[kind]}: pochi voti</span>
        </span>
      </span>
    );
  }

  const resolved = status ?? scoreStatus(percentage);
  const fresh = resolved === 'FRESH';
  const Thumb = fresh ? ThumbsUp : ThumbsDown;
  const reviewsText = totalReviews !== undefined ? ` su ${totalReviews} recensioni` : '';
  const verdict = fresh ? 'consigliato' : 'bocciato';

  return (
    <span
      role="img"
      aria-label={`Voto ${kindLabel[kind].toLowerCase()}: ${percentage}%${reviewsText}, ${verdict}`}
      className={cn(
        'inline-flex items-center rounded-lg border',
        fresh
          ? 'border-fresh/30 bg-fresh/[0.08] text-fresh'
          : 'border-rotten/30 bg-rotten/[0.08] text-rotten',
        s.box,
        className
      )}
    >
      <span aria-hidden="true" className="flex items-center gap-0.5">
        <KindIcon weight="regular" className={s.icon} />
        <Thumb weight="fill" className={s.icon} />
      </span>
      <span aria-hidden="true" className="flex flex-col leading-none">
        <span className={cn('font-mono font-medium tabular-nums', s.value)}>{percentage}%</span>
        {size !== 'sm' && (
          <span className="mt-1 text-[11px] tabular-nums text-fg-muted">
            {kindLabel[kind]}
            {totalReviews !== undefined && ` · ${totalReviews}`}
          </span>
        )}
      </span>
    </span>
  );
}
