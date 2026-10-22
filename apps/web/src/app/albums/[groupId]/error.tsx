'use client';

import React from 'react';
import { ErrorState } from '../../../components/ui';

export default function AlbumError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <ErrorState
        title="La puntina è saltata"
        description="Non siamo riusciti a caricare le edizioni di questo album. Riprova tra qualche istante."
        onRetry={reset}
      />
    </div>
  );
}
