import React from 'react';
import { cn, type ScoreBadgeSize } from './ui';
import { ScoreInline } from './discovery/ScoreFigure';

/** The four aggregate fields shared by `CatalogRelease` and `DualScoreDetails`. */
export interface DualScoreValues {
  criticFreshPct?: number | null;
  criticCount?: number;
  audienceFreshPct?: number | null;
  audienceCount?: number;
}

interface DualScoreBadgeProps {
  score: DualScoreValues;
  size?: ScoreBadgeSize;
  className?: string;
}

/**
 * ADR-001 dual score: accredited critics and the public, side by side, never blended. Quiet
 * inline figures (icon, tabular percentage, fresh/rotten thumb) rather than filled boxes.
 */
export const DualScoreBadge: React.FC<DualScoreBadgeProps> = ({
  score,
  size = 'md',
  className,
}) => {
  const criticCount = score.criticCount ?? 0;
  const audienceCount = score.audienceCount ?? 0;
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1', className)}>
      <ScoreInline
        kind="critic"
        percentage={criticCount > 0 ? (score.criticFreshPct ?? null) : null}
        count={criticCount}
        size={size}
      />
      <ScoreInline
        kind="audience"
        percentage={audienceCount > 0 ? (score.audienceFreshPct ?? null) : null}
        count={audienceCount}
        size={size}
      />
    </div>
  );
};
