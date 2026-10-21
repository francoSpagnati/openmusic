import type { Metadata } from 'next';
import React, { Suspense } from 'react';
import { Spinner } from '@/components/ui';
import { AuthScreen } from '@/components/web-core/auth/AuthScreen';

export const metadata: Metadata = {
  title: 'Accedi o registrati',
  description: 'Entra in OpenMusic con email e password, oppure crea un account gratuito.',
  robots: { index: false },
};

export default function AuthPage() {
  return (
    // useSearchParams() needs a Suspense boundary for static rendering.
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner size="lg" label="Caricamento…" />
        </div>
      }
    >
      <AuthScreen />
    </Suspense>
  );
}
