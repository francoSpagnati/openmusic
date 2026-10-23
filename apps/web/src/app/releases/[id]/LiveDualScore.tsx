'use client';

import React from 'react';
import { RatingStars } from '../../../components/ui';
import { ScoreFigure } from '../../../components/discovery/ScoreFigure';
import { formatStars, plural } from '../../../components/discovery/format';
import { useReleaseScore } from './ReleaseScoreContext';

function Average({ value, label }: { value: number | null; label: string }) {
  if (value === null) return null;
  return (
    <span className="flex items-center gap-2 text-sm text-fg-muted">
      <RatingStars value={value} size="sm" label={`${label}: media ${value.toFixed(1)} su 5`} />
      <span className="font-mono tabular-nums">{formatStars(value)}/5</span>
    </span>
  );
}

/** Critic and audience scores, side by side; updates live when the viewer reviews. */
export function LiveDualScore() {
  const { score } = useReleaseScore();
  return (
    <div className="space-y-5" aria-live="polite">
      <div className="grid gap-8 sm:grid-cols-2 sm:gap-0">
        <div className="space-y-3 sm:pr-8">
          <p className="om-eyebrow">Critica accreditata</p>
          <ScoreFigure
            kind="critic"
            percentage={score.criticCount > 0 ? score.criticFreshPct : null}
            count={score.criticCount}
          />
          <Average value={score.criticAvg} label="Critica" />
        </div>
        <div className="space-y-3 border-line sm:border-l sm:pl-8">
          <p className="om-eyebrow">Pubblico</p>
          <ScoreFigure
            kind="audience"
            percentage={score.audienceCount > 0 ? score.audienceFreshPct : null}
            count={score.audienceCount}
          />
          <Average value={score.audienceAvg} label="Pubblico" />
        </div>
      </div>
      <p className="max-w-prose text-xs text-fg-subtle">
        {plural(score.criticCount + score.audienceCount, 'voto', 'voti')} in tutto. Fresco da 70%
        (3,5 stelle) in su; nel voto del pubblico chi ha davvero ascoltato il disco pesa 1,5×.
      </p>
    </div>
  );
}
