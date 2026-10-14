'use client';

import React from 'react';
import { SealCheck, UsersThree, ThumbsUp, ThumbsDown } from '@phosphor-icons/react';

interface DualScoreBadgeProps {
  criticScore: {
    freshPercentage: number;
    totalReviews: number;
    status: 'FRESH' | 'ROTTEN';
  };
  audienceScore: {
    freshPercentage: number;
    totalReviews: number;
    status: 'FRESH' | 'ROTTEN';
  };
  size?: 'sm' | 'md' | 'lg';
}

export const DualScoreBadge: React.FC<DualScoreBadgeProps> = ({
  criticScore,
  audienceScore,
  size = 'md',
}) => {
  const isSm = size === 'sm';
  const isLg = size === 'lg';

  const criticColor = criticScore.status === 'FRESH' ? 'text-om-fresh' : 'text-om-rotten';
  const criticBg = criticScore.status === 'FRESH' ? 'bg-om-fresh/10 border-om-fresh/30' : 'bg-om-rotten/10 border-om-rotten/30';

  const audienceColor = audienceScore.status === 'FRESH' ? 'text-om-fresh' : 'text-om-rotten';
  const audienceBg = audienceScore.status === 'FRESH' ? 'bg-om-fresh/10 border-om-fresh/30' : 'bg-om-rotten/10 border-om-rotten/30';

  return (
    <div className={`flex items-center gap-2 sm:gap-4 ${isSm ? 'text-xs' : isLg ? 'text-base' : 'text-sm'}`}>
      {/* Critic Score Box */}
      <div
        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 backdrop-blur-sm transition-all ${criticBg}`}
        title={`Voto della Critica: ${criticScore.freshPercentage}% su ${criticScore.totalReviews} recensioni accreditate`}
      >
        <div className="flex items-center gap-1">
          <SealCheck weight="duotone" className={`h-4 w-4 ${criticColor}`} />
          {criticScore.status === 'FRESH' ? (
            <ThumbsUp weight="fill" className={`h-3 w-3 ${criticColor}`} />
          ) : (
            <ThumbsDown weight="fill" className={`h-3 w-3 ${criticColor}`} />
          )}
        </div>
        <div className="flex flex-col">
          <span className={`font-mono font-bold tabular-nums leading-none ${criticColor}`}>
            {criticScore.freshPercentage}%
          </span>
          {!isSm && (
            <span className="text-[10px] text-om-secondary font-mono leading-tight">
              Critica ({criticScore.totalReviews})
            </span>
          )}
        </div>
      </div>

      {/* Audience Score Box */}
      <div
        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 backdrop-blur-sm transition-all ${audienceBg}`}
        title={`Voto del Pubblico: ${audienceScore.freshPercentage}% su ${audienceScore.totalReviews} ascolti verificati`}
      >
        <div className="flex items-center gap-1">
          <UsersThree weight="duotone" className={`h-4 w-4 ${audienceColor}`} />
          {audienceScore.status === 'FRESH' ? (
            <ThumbsUp weight="fill" className={`h-3 w-3 ${audienceColor}`} />
          ) : (
            <ThumbsDown weight="fill" className={`h-3 w-3 ${audienceColor}`} />
          )}
        </div>
        <div className="flex flex-col">
          <span className={`font-mono font-bold tabular-nums leading-none ${audienceColor}`}>
            {audienceScore.freshPercentage}%
          </span>
          {!isSm && (
            <span className="text-[10px] text-om-secondary font-mono leading-tight">
              Pubblico ({audienceScore.totalReviews})
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
