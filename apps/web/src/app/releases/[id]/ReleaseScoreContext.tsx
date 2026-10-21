'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { DualScoreDetails } from '@openmusic/shared';
import { api } from '../../../lib/api';

interface ReleaseScoreContextValue {
  score: DualScoreDetails;
  /** Re-reads the dual score after the viewer publishes or edits a review. */
  refreshScore: () => Promise<void>;
}

const ReleaseScoreContext = createContext<ReleaseScoreContextValue | null>(null);

export function ReleaseScoreProvider({
  initialScore,
  children,
}: {
  initialScore: DualScoreDetails;
  children: React.ReactNode;
}) {
  const [score, setScore] = useState(initialScore);

  // A server refresh (router.refresh) brings newer props: adopt them.
  useEffect(() => setScore(initialScore), [initialScore]);

  const refreshScore = useCallback(async () => {
    try {
      setScore(await api.critic.dualScore(initialScore.releaseId));
    } catch {
      // The stale score stays visible; the next page load corrects it.
    }
  }, [initialScore.releaseId]);

  const value = useMemo(() => ({ score, refreshScore }), [score, refreshScore]);
  return <ReleaseScoreContext.Provider value={value}>{children}</ReleaseScoreContext.Provider>;
}

export function useReleaseScore(): ReleaseScoreContextValue {
  const ctx = useContext(ReleaseScoreContext);
  if (!ctx) throw new Error('useReleaseScore must be used inside ReleaseScoreProvider');
  return ctx;
}
