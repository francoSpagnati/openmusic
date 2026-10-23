'use client';

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { safeNextPath, useAuth } from '@/lib/auth';
import { Spinner, Tabs } from '@/components/ui';
import { BrandMark } from '../shell/BrandMark';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

type Mode = 'login' | 'register';

/**
 * Sign in / sign up. The mode lives in `?mode=` so links like "Crea un account" deep-link to the
 * right tab; `?next=` brings the user back where they were.
 */
export function AuthScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { status } = useAuth();
  const mode: Mode = params.get('mode') === 'register' ? 'register' : 'login';
  const next = safeNextPath(params.get('next'));

  // Already signed in (or just signed in): go to the destination.
  useEffect(() => {
    if (status === 'authenticated') router.replace(next);
  }, [status, next, router]);

  function switchMode(target: Mode) {
    const query = new URLSearchParams(params.toString());
    query.set('mode', target);
    router.replace(`/auth?${query.toString()}`, { scroll: false });
  }

  const done = () => router.replace(next);

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[26rem] flex-col px-4 pb-16 pt-10 sm:pt-16">
      <div className="flex justify-center">
        <BrandMark compact />
      </div>

      <section aria-labelledby="auth-title" className="om-enter mt-12 text-center">
        <h1 id="auth-title" className="om-headline text-display-sm text-fg">
          {mode === 'register' ? 'Apri il tuo scaffale.' : 'Bentornato al bancone.'}
        </h1>
        <p className="om-deck mx-auto mt-3 max-w-narrow text-fg-muted">
          {mode === 'register'
            ? 'Segui gli amici, scopri cosa ascoltano adesso e dai il tuo voto ai dischi.'
            : 'Riprendi da dove avevi lasciato: il feed dei tuoi amici ti aspetta.'}
        </p>
      </section>

      <div className="mt-10">
        {status === 'authenticated' ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Spinner size="lg" label={null} />
            <p role="status" className="text-sm text-fg-muted">
              Accesso effettuato. Ti stiamo portando al tuo feed…
            </p>
          </div>
        ) : (
          <Tabs
            label="Accesso o registrazione"
            variant="pill"
            value={mode}
            onValueChange={(id) => switchMode(id === 'register' ? 'register' : 'login')}
            className="[&>[role=tablist]>button]:flex-1 [&>[role=tablist]>button]:justify-center"
            panelClassName="pt-8"
            items={[
              {
                id: 'login',
                label: 'Accedi',
                content: (
                  <LoginForm onSuccess={done} onSwitchToRegister={() => switchMode('register')} />
                ),
              },
              {
                id: 'register',
                label: 'Registrati',
                content: (
                  <RegisterForm onSuccess={done} onSwitchToLogin={() => switchMode('login')} />
                ),
              },
            ]}
          />
        )}
      </div>

      <p className="mt-12 text-center text-xs text-fg-subtle">
        Spotify e Last.fm sono facoltativi: li colleghi dopo, dalle impostazioni.
      </p>
    </div>
  );
}
