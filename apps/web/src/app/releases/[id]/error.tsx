'use client';

import React from 'react';
import { ErrorState } from '../../../components/ui';

export default function ReleaseError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <ErrorState
        title="La puntina è saltata"
        description="Non siamo riusciti a caricare questo disco. Riprova tra qualche istante."
        onRetry={reset}
      />
    </div>
  );
}
