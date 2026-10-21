'use client';

import React from 'react';
import { RatingStars, ScoreBadge } from '../../../components/ui';
import { plural } from '../../../components/discovery/format';
import { useReleaseScore } from './ReleaseScoreContext';

function Average({ value, label }: { value: number | null; label: string }) {
  if (value === null) return null;
  return (
    <span className="flex items-center gap-2 text-xs text-ink-secondary">
      <RatingStars value={value} size="sm" label={`${label}: media ${value.toFixed(1)} su 5`} />
      <span className="font-mono tabular-nums">{value.toFixed(1)}/5</span>
    </span>
  );
}

/** Critic and audience scores, side by side; updates live when the viewer reviews. */
export function LiveDualScore() {
  const { score } = useReleaseScore();
  return (
    <div className="grid gap-4 sm:grid-cols-2" aria-live="polite">
      <div className="space-y-2">
        <p className="om-eyebrow">Critica accreditata</p>
        <ScoreBadge
          kind="critic"
          size="lg"
          percentage={score.criticCount > 0 ? score.criticFreshPct : null}
          totalReviews={score.criticCount}
        />
        <Average value={score.criticAvg} label="Critica" />
      </div>
      <div className="space-y-2">
        <p className="om-eyebrow">Pubblico</p>
        <ScoreBadge
          kind="audience"
          size="lg"
          percentage={score.audienceCount > 0 ? score.audienceFreshPct : null}
          totalReviews={score.audienceCount}
        />
        <Average value={score.audienceAvg} label="Pubblico" />
      </div>
      <p className="text-xs text-ink-muted sm:col-span-2">
        {plural(score.criticCount + score.audienceCount, 'voto', 'voti')} in tutto. Fresco da 70%
        (3,5 stelle) in su; nel voto del pubblico chi ha davvero ascoltato il disco pesa 1,5×.
      </p>
    </div>
  );
}
