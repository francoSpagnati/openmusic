import React from 'react';
import { ScoreBadge, cn, type ScoreBadgeSize } from './ui';

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

/** ADR-001 dual score: accredited critics and the public, side by side, never blended. */
export const DualScoreBadge: React.FC<DualScoreBadgeProps> = ({
  score,
  size = 'md',
  className,
}) => {
  const criticCount = score.criticCount ?? 0;
  const audienceCount = score.audienceCount ?? 0;
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <ScoreBadge
        kind="critic"
        percentage={criticCount > 0 ? (score.criticFreshPct ?? null) : null}
        totalReviews={criticCount}
        size={size}
      />
      <ScoreBadge
        kind="audience"
        percentage={audienceCount > 0 ? (score.audienceFreshPct ?? null) : null}
        totalReviews={audienceCount}
        size={size}
      />
    </div>
  );
};
