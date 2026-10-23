'use client';

import React from 'react';
import Link from 'next/link';
import { Heart, Lightbulb, PenNib, ThumbsUp, type Icon } from '@phosphor-icons/react';
import type { ReactionType } from '@openmusic/shared';
import { cn } from '../../../components/ui';

export const REACTIONS: Array<{ type: ReactionType; label: string; icon: Icon }> = [
  { type: 'AGREE', label: 'Condivido', icon: ThumbsUp },
  { type: 'WELL_WRITTEN', label: 'Ben scritta', icon: PenNib },
  { type: 'DISCOVERED', label: 'Scoperto grazie a te', icon: Lightbulb },
  { type: 'HEART', label: 'Cuore', icon: Heart },
];

const pill =
  'inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors duration-fast ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

interface ReviewReactionsProps {
  counts: Partial<Record<ReactionType, number>>;
  mine: ReactionType[];
  /** null = anonymous viewer (buttons become a sign-in prompt). */
  onToggle: ((type: ReactionType) => void) | null;
  loginHref: string;
  /** Authors cannot react to their own review. */
  disabled?: boolean;
  pending: ReactionType | null;
}

/** Constructive reactions (ADR-002): toggles with counts, one of each per reader. */
export function ReviewReactions({
  counts,
  mine,
  onToggle,
  loginHref,
  disabled,
  pending,
}: ReviewReactionsProps) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Reazioni alla recensione">
      {REACTIONS.map(({ type, label, icon: ReactionIcon }) => {
        const count = counts[type] ?? 0;
        const active = mine.includes(type);
        const content = (
          <>
            <ReactionIcon
              aria-hidden="true"
              weight={active ? 'fill' : 'regular'}
              className="h-4 w-4"
            />
            <span className="hidden sm:inline">{label}</span>
            <span className="font-mono tabular-nums">{count}</span>
          </>
        );
        const look = cn(
          pill,
          active
            ? 'border-accent/60 bg-accent/10 text-accent'
            : 'border-line text-fg-muted hover:border-line-strong hover:text-fg'
        );
        return (
          <li key={type}>
            {onToggle ? (
              <button
                type="button"
                aria-pressed={active}
                aria-label={`${label}: ${count}`}
                title={label}
                disabled={disabled || pending === type}
                onClick={() => onToggle(type)}
                className={cn(look, 'disabled:cursor-not-allowed disabled:opacity-60')}
              >
                {content}
              </button>
            ) : (
              <Link
                href={loginHref}
                aria-label={`${label}: ${count}. Accedi per reagire`}
                title={label}
                className={look}
              >
                {content}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
