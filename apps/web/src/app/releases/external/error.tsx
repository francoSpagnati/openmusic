'use client';

import React from 'react';
import { ErrorState } from '../../../components/ui';

/** The provider (Deezer, iTunes, MusicBrainz) did not answer: let the user try again. */
export default function ExternalReleaseError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <ErrorState
        title="Il disco non è arrivato"
        description="Il catalogo esterno non risponde in questo momento. Riprova tra qualche istante."
        onRetry={reset}
      />
    </div>
  );
}
